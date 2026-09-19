/**
 * Fearless Teenpreneur 캘린더 → Google 캘린더 연동 스크립트
 *
 * 이 파일 전체를 복사해 https://script.google.com 의 새 프로젝트에 붙여넣고
 * "배포 → 새 배포 → 웹 앱"으로 배포하세요. 자세한 절차는 README.md를 보세요.
 *
 * 이 스크립트는 본인 Google 계정으로 실행되므로, Cloud Console 등록이나
 * OAuth 클라이언트 ID가 필요 없습니다. 권한은 처음 배포할 때 한 번만 승인합니다.
 */

/**
 * 비밀 값 (선택).
 *
 * 배포 URL 자체가 추측하기 어려운 긴 문자열이라 사실상 비밀번호 역할을 합니다.
 * 여기에 아무 문자열이나 채우면 한 겹 더 두를 수 있습니다. 채웠다면 앱의
 * "비밀 값" 칸에 똑같이 적어야 합니다. 비워 두면 검사하지 않습니다.
 */
const SECRET = '';

/** 앱이 보낸 작업 묶음을 처리한다 */
function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);

    if (SECRET && req.secret !== SECRET) {
      return reply({ ok: false, error: 'unauthorized' });
    }

    const cal = CalendarApp.getDefaultCalendar();
    const ops = req.ops || [];
    const results = [];
    for (let i = 0; i < ops.length; i++) {
      results.push(applyOp(cal, ops[i]));
    }

    return reply({ ok: true, calendarName: cal.getName(), results: results });
  } catch (err) {
    return reply({ ok: false, error: errText(err) });
  }
}

/** 브라우저로 URL을 직접 열었을 때 — 배포가 살아 있는지 눈으로 확인하는 용도 */
function doGet() {
  try {
    return reply({
      ok: true,
      calendarName: CalendarApp.getDefaultCalendar().getName(),
    });
  } catch (err) {
    return reply({ ok: false, error: errText(err) });
  }
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function errText(err) {
  return String(err && err.message ? err.message : err);
}

/**
 * 작업 하나를 처리한다. 한 건이 실패해도 나머지는 계속 진행되도록
 * 실패를 결과 배열에 담아 돌려준다 — 예외로 전체를 중단시키지 않는다.
 */
function applyOp(cal, op) {
  try {
    if (op.kind === 'delete') {
      const target = findEvent(cal, op.gcalId);
      // 이미 없으면 목적은 달성된 것이다
      if (target) target.deleteEvent();
      return { localId: op.localId, ok: true };
    }

    // patch인데 Google 쪽에 일정이 없으면(사용자가 지웠거나 계정이 바뀜)
    // 새로 만들어 스스로 복구한다
    let ev = op.kind === 'patch' ? findEvent(cal, op.gcalId) : null;

    if (ev) {
      ev.setTitle(op.title);
      ev.setTime(new Date(op.start), new Date(op.end));
    } else {
      ev = cal.createEvent(op.title, new Date(op.start), new Date(op.end));
    }

    ev.setDescription(op.description || '');
    if (op.colorId) ev.setColor(op.colorId);

    // 알림은 항상 앱의 설정으로 덮어쓴다 — 껐으면 기본 알림도 남지 않아야 한다
    ev.removeAllReminders();
    if (op.reminderMinutes !== null && op.reminderMinutes !== undefined) {
      ev.addPopupReminder(op.reminderMinutes);
    }

    return { localId: op.localId, ok: true, gcalId: ev.getId() };
  } catch (err) {
    return { localId: op.localId, ok: false, error: errText(err) };
  }
}

function findEvent(cal, id) {
  if (!id) return null;
  try {
    return cal.getEventById(id);
  } catch (err) {
    return null;
  }
}
