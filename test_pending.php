<?php
require_once 'db.php';

// Check what's in payments
$stmt = $pdo->query("SELECT id, category, status, amount, description FROM payments ORDER BY id DESC");
$payments = $stmt->fetchAll();
echo "All payments:\n";
foreach ($payments as $p) {
    echo "  ID {$p['id']}: category={$p['category']}, status={$p['status']}, amount={$p['amount']}, desc={$p['description']}\n";
}

// Check pending wages specifically
$stmt = $pdo->prepare("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE status = 'pending' AND category = 'wage'");
$stmt->execute();
$pending_wages = $stmt->fetch()['total'];
echo "\nPending wages (category='wage' AND status='pending'): $pending_wages\n";

// Check ALL pending
$stmt = $pdo->prepare("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE status = 'pending'");
$stmt->execute();
$all_pending = $stmt->fetch()['total'];
echo "All pending (any category): $all_pending\n";

// Check ALL paid
$stmt = $pdo->prepare("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE status = 'paid'");
$stmt->execute();
$all_paid = $stmt->fetch()['total'];
echo "All paid: $all_paid\n";
