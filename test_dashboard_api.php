<?php
require_once 'db.php';
session_start();
$_SESSION['user_id'] = 1;
$_SESSION['username'] = 'admin';
$_SESSION['full_name'] = 'Site Manager';

// Simulate dashboard API call
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['action'] = '';
ob_start();
include 'api/dashboard.php';
$result = ob_get_clean();
$data = json_decode($result, true);
echo "Dashboard API response:\n";
echo "pending_payments: {$data['pending_payments']}\n";
echo "weekly_expenditure: {$data['weekly_expenditure']}\n";
echo "materials_remaining: {$data['materials_remaining']}\n";
