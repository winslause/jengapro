<?php
require_once __DIR__ . '/../db.php';
header('Content-Type: application/json');

requireLogin();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Week runs Sunday -> Saturday. Returns [start(Sun), end(Sat)] as Y-m-d
function weekRange($ref = null) {
    $ref = $ref ? new DateTime($ref) : new DateTime();
    $ref->setTime(0, 0, 0);
    $dow = (int)$ref->format('w'); // 0=Sun ... 6=Sat
    $start = clone $ref;
    $start->modify("-{$dow} days");
    $end = clone $start;
    $end->modify('+6 days');
    return [$start->format('Y-m-d'), $end->format('Y-m-d')];
}

// Weekly refresh: delete attendance older than the current week's start
function weeklyResetIfNeeded($pdo) {
    [$start] = weekRange();
    $pdo->prepare("DELETE FROM attendance WHERE work_date < ?")->execute([$start]);
}

// Get the 7-day week range + which workers are present on each day
if ($method === 'GET' && $action === 'week') {
    weeklyResetIfNeeded($pdo);
    [$start, $end] = weekRange();
    $days = [];
    $d = new DateTime($start);
    for ($i = 0; $i < 7; $i++) {
        $days[] = $d->format('Y-m-d');
        $d->modify('+1 day');
    }
    $place = str_repeat('?,', count($days) - 1) . '?';
    $stmt = $pdo->prepare("SELECT worker_id, work_date FROM attendance WHERE work_date IN ($place) AND present = 1");
    $stmt->execute($days);
    $map = [];
    foreach ($stmt->fetchAll() as $row) {
        $map[$row['work_date']][] = (int)$row['worker_id'];
    }
    $presentByDay = [];
    foreach ($days as $day) { $presentByDay[$day] = $map[$day] ?? []; }
    $locked = [];
    $lst = $pdo->prepare("SELECT worker_id FROM paid_weeks WHERE week_start = ?");
    $lst->execute([$start]);
    foreach ($lst->fetchAll() as $r) { $locked[] = (int)$r['worker_id']; }
    apiResponse(true, '', ['start' => $start, 'end' => $end, 'days' => $days, 'present_by_day' => $presentByDay, 'locked_workers' => $locked]);
}

// Toggle a single worker's attendance for a given date (used by checkboxes)
if ($method === 'POST' && $action === 'toggle') {
    $data = getJsonInput();
    $workerId = (int)($data['worker_id'] ?? 0);
    $date = $data['work_date'] ?? '';
    $checked = !empty($data['checked']);
    if (!$workerId || !$date) apiResponse(false, 'worker_id and work_date required.');
    if ($checked) {
        $pdo->prepare("INSERT INTO attendance (worker_id, work_date, present) VALUES (?, ?, 1)
            ON DUPLICATE KEY UPDATE present = 1")->execute([$workerId, $date]);
    } else {
        $pdo->prepare("DELETE FROM attendance WHERE worker_id = ? AND work_date = ?")->execute([$workerId, $date]);
    }
    apiResponse(true, 'Updated.');
}

// Legacy: save all present workers for a single date
if ($method === 'POST' && $action === 'save') {
    weeklyResetIfNeeded($pdo);
    $data = getJsonInput();
    $date = $data['work_date'] ?? date('Y-m-d');
    $present = $data['present'] ?? [];
    $pdo->beginTransaction();
    try {
        $pdo->prepare("DELETE FROM attendance WHERE work_date = ?")->execute([$date]);
        $ins = $pdo->prepare("INSERT INTO attendance (worker_id, work_date, present) VALUES (?, ?, 1)
            ON DUPLICATE KEY UPDATE present = 1");
        foreach ($present as $wid) { $ins->execute([(int)$wid, $date]); }
        $pdo->commit();
        apiResponse(true, 'Attendance saved.');
    } catch (Exception $e) {
        $pdo->rollBack();
        apiResponse(false, 'Failed to save attendance: ' . $e->getMessage());
    }
}

apiResponse(false, 'Unknown action.');
