<?php
require_once 'db.php';
// If already logged in, go straight to dashboard
if (isset($_SESSION['user_id'])) {
    header('Location: index.html');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JengaPro - Login</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <style>
        body { background: linear-gradient(135deg, #1e3a8a, #2563eb); }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4">

    <!-- Toast container -->
    <div id="toastContainer" class="fixed top-4 right-4 z-50 flex flex-col space-y-2"></div>

    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-8">
        <div class="text-center mb-6">
            <i class="fas fa-hard-hat text-5xl text-blue-600 mb-3"></i>
            <h1 class="text-2xl font-bold text-gray-800">JengaPro</h1>
            <p class="text-gray-500 text-sm">Construction Site Management</p>
        </div>

        <!-- Login Form -->
        <form id="loginForm">
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <div class="relative">
                    <span class="absolute left-3 top-2.5 text-gray-400"><i class="fas fa-user"></i></span>
                    <input type="text" name="username" required class="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="admin">
                </div>
            </div>
            <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div class="relative">
                    <span class="absolute left-3 top-2.5 text-gray-400"><i class="fas fa-lock"></i></span>
                    <input type="password" name="password" required class="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="********">
                </div>
            </div>
            <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 font-medium">
                <i class="fas fa-sign-in-alt mr-2"></i>Login
            </button>
            <p class="text-center text-sm text-gray-500 mt-4">
                No account? <a href="#" id="showRegister" class="text-blue-600 hover:underline">Register here</a>
            </p>
        </form>

        <!-- Register Form (hidden) -->
        <form id="registerForm" class="hidden">
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" name="full_name" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Site Manager">
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input type="text" name="username" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="username">
            </div>
            <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" name="password" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="********">
            </div>
            <button type="submit" class="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 font-medium">
                <i class="fas fa-user-plus mr-2"></i>Create Account
            </button>
            <p class="text-center text-sm text-gray-500 mt-4">
                Already have an account? <a href="#" id="showLogin" class="text-blue-600 hover:underline">Login here</a>
            </p>
        </form>
    </div>

    <script>
        const toastContainer = document.getElementById('toastContainer');
        function showToast(message, type = 'success') {
            const colors = {
                success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600', warning: 'bg-yellow-500'
            };
            const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
            const el = document.createElement('div');
            el.className = `${colors[type]} text-white px-4 py-3 rounded shadow-lg flex items-center space-x-2 transition transform translate-x-0`;
            el.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
            toastContainer.appendChild(el);
            setTimeout(() => {
                el.style.opacity = '0';
                el.style.transform = 'translateX(120%)';
                setTimeout(() => el.remove(), 300);
            }, 3500);
        }

        document.getElementById('showRegister').onclick = (e) => {
            e.preventDefault();
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('registerForm').classList.remove('hidden');
        };
        document.getElementById('showLogin').onclick = (e) => {
            e.preventDefault();
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('loginForm').classList.remove('hidden');
        };

        document.getElementById('loginForm').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const data = Object.fromEntries(fd.entries());
            try {
                const res = await fetch('api/auth.php?action=login', {
                    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)
                });
                const out = await res.json();
                if (out.success) {
                    showToast(out.message, 'success');
                    setTimeout(() => location.href = 'index.html', 800);
                } else {
                    showToast(out.message, 'error');
                }
            } catch (err) { showToast('Network error', 'error'); }
        };

        document.getElementById('registerForm').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const data = Object.fromEntries(fd.entries());
            try {
                const res = await fetch('api/auth.php?action=register', {
                    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)
                });
                const out = await res.json();
                showToast(out.message, out.success ? 'success' : 'error');
                if (out.success) {
                    document.getElementById('registerForm').classList.add('hidden');
                    document.getElementById('loginForm').classList.remove('hidden');
                    e.target.reset();
                }
            } catch (err) { showToast('Network error', 'error'); }
        };
    </script>
</body>
</html>
