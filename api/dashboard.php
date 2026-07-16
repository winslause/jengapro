<?php
require_once __DIR__ . '/../db.php';
header('Content-Type: application/json');

requireLogin();

// Aggregate stats for the dashboard
$stats = [];

// Materials in stock = count of materials with remaining > 0
$stmt = $pdo->query("SELECT COUNT(*) AS c, COALESCE(SUM(quantity_delivered - quantity_used),0) AS total_remaining FROM materials");
$r = $stmt->fetch();
$stats['materials_count'] = (int)$r['c'];
$stats['materials_remaining'] = (int)$r['total_remaining'];

// Workers
$stmt = $pdo->query("SELECT worker_type, COUNT(*) AS c FROM workers GROUP BY worker_type");
$types = [];
foreach ($stmt->fetchAll() as $row) { $types[$row['worker_type']] = (int)$row['c']; }
$stats['workers_total'] = array_sum($types);
$stats['workers_by_type'] = $types;

// Today's attendance
$today = date('Y-m-d');
$stmt = $pdo->prepare("SELECT COUNT(*) AS c FROM attendance WHERE work_date = ? AND present = 1");
$stmt->execute([$today]);
$stats['workers_present_today'] = (int)$stmt->fetch()['c'];

// Weekly expenditure (last 7 days)
$stmt = $pdo->prepare("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND status = 'paid'");
$stmt->execute();
$stats['weekly_expenditure'] = (float)$stmt->fetch()['total'];

// Total pending payments
$stmt = $pdo->query("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE status = 'pending'");
$stats['pending_payments'] = (float)$stmt->fetch()['total'];

// Overall progress = latest percentage per milestone, averaged
$stmt = $pdo->query("SELECT milestone, MAX(percentage) AS pct FROM progress GROUP BY milestone");
$milestones = [];
$sum = 0; $cnt = 0;
foreach ($stmt->fetchAll() as $row) { $milestones[$row['milestone']] = (int)$row['pct']; $sum += $row['pct']; $cnt++; }
$stats['milestones'] = $milestones;
$stats['project_progress'] = $cnt ? round($sum / $cnt) : 0;

// Expenditure chart (last 5 payments grouped by category)
$stats['expenditure_by_type'] = [];
$stmt = $pdo->query("SELECT COALESCE(worker_type,'material') AS cat, COALESCE(SUM(amount),0) AS total FROM payments GROUP BY cat");
foreach ($stmt->fetchAll() as $row) { $stats['expenditure_by_type'][$row['cat']] = (float)$row['total']; }

// Progress over time (last 10 progress records)
$stmt = $pdo->query("SELECT progress_date, percentage FROM progress ORDER BY progress_date ASC LIMIT 10");
$stats['progress_timeline'] = $stmt->fetchAll();

apiResponse(true, '', $stats);
