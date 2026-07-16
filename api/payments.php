<?php
require_once __DIR__ . '/../db.php';
header('Content-Type: application/json');

requireLogin();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Week (Sun -> Sat)
function weekStart($ref = null) {
    $ref = $ref ? new DateTime($ref) : new DateTime();
    $ref->setTime(0, 0, 0);
    $dow = (int)$ref->format('w');
    $start = clone $ref;
    $start->modify("-{$dow} days");
    return $start->format('Y-m-d');
}

// Per-worker wage summary: pending total, paid total, last status, days covered
if ($method === 'GET' && $action === 'wages') {
    $ws = weekStart();
    $stmt = $pdo->query("SELECT w.id, w.name, w.worker_type, w.daily_rate,
        COALESCE(SUM(CASE WHEN p.status='pending' AND (p.category='wage' OR p.category IS NULL) THEN p.amount ELSE 0 END),0) AS pending_total,
        COALESCE(SUM(CASE WHEN p.status='paid' AND (p.category='wage' OR p.category IS NULL) THEN p.amount ELSE 0 END),0) AS paid_total,
        MAX(CASE WHEN (p.category='wage' OR p.category IS NULL) THEN p.status ELSE NULL END) AS last_status
        FROM workers w
        LEFT JOIN payments p ON p.worker_id = w.id
        GROUP BY w.id
        ORDER BY w.name");
    $rows = $stmt->fetchAll();
    // Is this week already paid/locked?
    $locked = [];
    $lst = $pdo->prepare("SELECT worker_id FROM paid_weeks WHERE week_start = ?");
    $lst->execute([$ws]);
    foreach ($lst->fetchAll() as $r) { $locked[] = (int)$r['worker_id']; }
    apiResponse(true, '', ['week_start' => $ws, 'workers' => $rows, 'locked_workers' => $locked]);
}

// Confirm payment for a worker: mark all pending wage payments paid + lock attendance for the week
if ($method === 'POST' && $action === 'confirmWage') {
    $data = getJsonInput();
    $workerId = (int)($data['worker_id'] ?? 0);
    if (!$workerId) apiResponse(false, 'worker_id required.');
    $ws = weekStart();
    $pdo->beginTransaction();
    try {
        $upd = $pdo->prepare("UPDATE payments SET status='paid', week_start=? WHERE worker_id=? AND category='wage' AND status='pending'");
        $upd->execute([$ws, $workerId]);
        $pdo->prepare("INSERT IGNORE INTO paid_weeks (worker_id, week_start) VALUES (?, ?)")->execute([$workerId, $ws]);
        $pdo->commit();
        apiResponse(true, 'Payment confirmed. Attendance locked for the week.');
    } catch (Exception $e) {
        $pdo->rollBack();
        apiResponse(false, 'Failed: ' . $e->getMessage());
    }
}

apiResponse(false, 'Unknown action.');
