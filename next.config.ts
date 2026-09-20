import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// 같은 와이파이의 아이패드·폰에서 개발 서버에 붙을 수 있게 이 기기의 LAN 주소를 허용한다.
const lanHosts = Object.values(networkInterfaces())
  .flat()
  .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
  .map((entry) => entry!.address);

const nextConfig: NextConfig = {
  // better-sqlite3 는 네이티브 모듈이라 번들에 포함하지 않는다.
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: ["localhost", "127.0.0.1", ...lanHosts, "192.168.*.*", "10.*.*.*"],
  turbopack: {},
};

export default nextConfig;
