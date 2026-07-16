<?php
require_once __DIR__ . '/../db.php';
header('Content-Type: application/json');

$action = $_GET['action'] ?? '';

if ($action === 'login') {
    $data = getJsonInput();
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if (!$username || !$password) {
        apiResponse(false, 'Username and password are required.');
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        apiResponse(false, 'Invalid username or password.');
    }

    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['full_name'] = $user['full_name'];

    apiResponse(true, 'Login successful.', [
        'user' => ['id' => $user['id'], 'username' => $user['username'], 'full_name' => $user['full_name']]
    ]);
}

if ($action === 'register') {
    $data = getJsonInput();
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';
    $full_name = trim($data['full_name'] ?? '');

    if (!$username || !$password) {
        apiResponse(false, 'Username and password are required.');
    }

    $stmt = $pdo->prepare("SELECT COUNT(*) AS c FROM users WHERE username = ?");
    $stmt->execute([$username]);
    if ($stmt->fetch()['c'] > 0) {
        apiResponse(false, 'Username already exists.');
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $pdo->prepare("INSERT INTO users (username, password, full_name) VALUES (?, ?, ?)")
        ->execute([$username, $hash, $full_name]);

    apiResponse(true, 'Account created. You can now log in.');
}

if ($action === 'logout') {
    session_destroy();
    apiResponse(true, 'Logged out.');
}

if ($action === 'me') {
    if (isset($_SESSION['user_id'])) {
        apiResponse(true, '', ['user' => [
            'id' => $_SESSION['user_id'],
            'username' => $_SESSION['username'],
            'full_name' => $_SESSION['full_name']
        ]]);
    }
    apiResponse(false, 'Not logged in.');
}

apiResponse(false, 'Unknown action.');
