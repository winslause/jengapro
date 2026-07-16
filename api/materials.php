<?php
require_once __DIR__ . '/../db.php';
header('Content-Type: application/json');

requireLogin();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Week (Sun -> Sat)
function matWeekRange($ref = null) {
    $ref = $ref ? new DateTime($ref) : new DateTime();
    $ref->setTime(0, 0, 0);
    $dow = (int)$ref->format('w');
    $start = clone $ref; $start->modify("-{$dow} days");
    $end = clone $start; $end->modify('+6 days');
    return [$start->format('Y-m-d'), $end->format('Y-m-d')];
}

// Per-material summary: delivered, used total/today/week, remaining, low flag
if ($method === 'GET' && $action === 'summary') {
    $today = date('Y-m-d');
    [$ws, $we] = matWeekRange();
    $stmt = $pdo->query("SELECT m.*,
        COALESCE((SELECT SUM(quantity_used) FROM material_usage u WHERE u.material_id = m.id),0) AS used_total,
        COALESCE((SELECT SUM(quantity_used) FROM material_usage u WHERE u.material_id = m.id AND u.use_date = '$today'),0) AS used_today,
        COALESCE((SELECT SUM(quantity_used) FROM material_usage u WHERE u.material_id = m.id AND u.use_date BETWEEN '$ws' AND '$we'),0) AS used_week
        FROM materials m ORDER BY m.name");
    $rows = $stmt->fetchAll();
    $low = [];
    foreach ($rows as &$r) {
        $r['remaining'] = ($r['quantity_delivered'] ?? 0) - ($r['used_total'] ?? 0);
        $r['is_low'] = ($r['low_stock_threshold'] > 0 && $r['remaining'] <= $r['low_stock_threshold']) || $r['remaining'] <= 0;
        if ($r['is_low']) $low[] = ['id' => $r['id'], 'name' => $r['name'], 'remaining' => $r['remaining'], 'unit' => $r['unit']];
    }
    apiResponse(true, '', ['today' => $today, 'week_start' => $ws, 'week_end' => $we, 'materials' => $rows, 'low_stock' => $low]);
}

// Log daily usage for a material
if ($method === 'POST' && $action === 'usage') {
    $data = getJsonInput();
    $mid = (int)($data['material_id'] ?? 0);
    $date = $data['use_date'] ?? date('Y-m-d');
    $qty = (float)($data['quantity_used'] ?? 0);
    $note = $data['note'] ?? '';
    if (!$mid || $qty <= 0) apiResponse(false, 'Valid material and quantity required.');
    $pdo->prepare("INSERT INTO material_usage (material_id, use_date, quantity_used, note) VALUES (?, ?, ?, ?)")
        ->execute([$mid, $date, $qty, $note]);
    // keep materials.quantity_used in sync (for backward compat / quick reads)
    $pdo->prepare("UPDATE materials SET quantity_used = (SELECT COALESCE(SUM(quantity_used),0) FROM material_usage WHERE material_id = ?) WHERE id = ?")
        ->execute([$mid, $mid]);
    apiResponse(true, 'Usage logged.', ['id' => $pdo->lastInsertId()]);
}

// Weekly report: total used per category (unit group), total added & used & remaining per material, days covered
if ($method === 'GET' && $action === 'report') {
    [$ws, $we] = matWeekRange();
    // Materials detail
    $stmt = $pdo->query("SELECT m.id, m.name, m.unit, m.quantity_delivered,
        COALESCE((SELECT SUM(quantity_used) FROM material_usage u WHERE u.material_id = m.id AND u.use_date BETWEEN '$ws' AND '$we'),0) AS used_week,
        COALESCE((SELECT SUM(quantity_used) FROM material_usage u WHERE u.material_id = m.id),0) AS used_total
        FROM materials m ORDER BY m.name");
    $mats = $stmt->fetchAll();
    foreach ($mats as &$m) {
        $m['added_week'] = (int)$m['quantity_delivered']; // delivered is the added stock (we treat deliveries within week as added)
        $m['remaining'] = ($m['quantity_delivered'] ?? 0) - ($m['used_total'] ?? 0);
    }
    // Used per category (by unit) this week
    $stmt = $pdo->query("SELECT m.unit AS category, COALESCE(SUM(u.quantity_used),0) AS total_used
        FROM material_usage u JOIN materials m ON m.id = u.material_id
        WHERE u.use_date BETWEEN '$ws' AND '$we' GROUP BY m.unit");
    $perCategory = [];
    foreach ($stmt->fetchAll() as $r) { $perCategory[$r['category']] = (float)$r['total_used']; }
    // Distinct days with usage this week
    $stmt = $pdo->query("SELECT DISTINCT use_date FROM material_usage WHERE use_date BETWEEN '$ws' AND '$we' ORDER BY use_date");
    $days = array_column($stmt->fetchAll(), 'use_date');

    apiResponse(true, '', [
        'week_start' => $ws, 'week_end' => $we,
        'days' => $days, 'per_category_used' => $perCategory, 'materials' => $mats
    ]);
}

apiResponse(false, 'Unknown action.');
