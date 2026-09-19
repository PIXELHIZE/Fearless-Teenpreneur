import assert from "node:assert/strict";
import test from "node:test";
import OpenAI from "openai";
import { z } from "zod";
import { requestStructured, PhaseTimeoutError } from "../src/lib/exam/openai-pipeline";

const schema = z.object({ value: z.string() });
function streamResponse(status = "completed", output = JSON.stringify({ value: "ok" })) {
  const base = { id: "resp_test", object: "response", output: [], status: "in_progress" };
  const final = {
    ...base, status,
    incomplete_details: status === "incomplete" ? { reason: "max_output_tokens" } : null,
    output: [{ id: "msg_test", type: "message", role: "assistant", status: "completed", content: [
      { type: "output_text", text: output, annotations: [] },
    ] }],
  };
  return new Response([
    { type: "response.created", response: base, sequence_number: 0 },
    { type: `response.${status}`, response: final, sequence_number: 1 },
  ].map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""), {
    headers: { "Content-Type": "text/event-stream" },
  });
}

test("SDK의 실제 SSE 파서로 완료 응답을 읽고 스트리밍·비저장 옵션을 유지한다", async () => {
  let body: Record<string, unknown> = {};
  const client = new OpenAI({ apiKey: "test-key", fetch: async (_, init) => {
    body = JSON.parse(String(init?.body));
    return streamResponse();
  } });
  const result = await requestStructured(client, { model: "test", store: false }, schema, "검증");
  assert.deepEqual(result.output_parsed, { value: "ok" });
  assert.equal(body.stream, true);
  assert.equal(body.store, false);
});

test("JSON이 유효해도 미완료 응답은 채택하지 않는다", async () => {
  const client = new OpenAI({ apiKey: "test-key", fetch: async () => streamResponse("incomplete") });
  await assert.rejects(requestStructured(client, { model: "test" }, schema, "검증"), /응답 미완료.*max_output_tokens/);
});

test("스트림 중간에 멈추어도 전체 제한 시간에 중단하며 SDK 재시도는 하지 않는다", async () => {
  let calls = 0;
  const client = new OpenAI({ apiKey: "test-key", timeout: 40, fetch: async (_, init) => {
    calls++;
    return new Response(new ReadableStream({
      start(controller) {
        init?.signal?.addEventListener("abort", () => controller.error(new Error("aborted")), { once: true });
      },
    }), { headers: { "Content-Type": "text/event-stream" } });
  } });
  await assert.rejects(requestStructured(client, { model: "test" }, schema, "검증"), PhaseTimeoutError);
  assert.equal(calls, 1);
});

test("파싱 오류와 API 인증 오류를 성공으로 처리하거나 재시도하지 않는다", async () => {
  const invalid = new OpenAI({ apiKey: "test-key", fetch: async () => streamResponse("completed", "invalid JSON") });
  await assert.rejects(requestStructured(invalid, { model: "test" }, schema, "검증"), SyntaxError);
  let calls = 0;
  const unauthorized = new OpenAI({ apiKey: "test-key", fetch: async () => {
    calls++;
    return new Response(JSON.stringify({ error: { message: "invalid key" } }), { status: 401 });
  } });
  await assert.rejects(requestStructured(unauthorized, { model: "test" }, schema, "검증"), OpenAI.AuthenticationError);
  assert.equal(calls, 1);
});
