<?php
require_once __DIR__ . '/../db.php';
header('Content-Type: application/json');

requireLogin();

// Live weather via OpenWeatherMap. Pass ?lat=&lon= (from browser geolocation).
$lat = $_GET['lat'] ?? null;
$lon = $_GET['lon'] ?? null;

if (!$lat || !$lon) {
    apiResponse(false, 'Location coordinates required (lat, lon).');
}

$key = WEATHER_API_KEY;

function fetchJson($url) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_SSL_VERIFYPEER => false,
    ]);
    $resp = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($err) return ['error' => $err];
    return json_decode($resp, true);
}

// 1) Try One Call API 3.0 for a true 7-8 day daily forecast
$oneCallUrl = "https://api.openweathermap.org/data/3.0/onecall?lat={$lat}&lon={$lon}&units=metric&exclude=minutely,hourly,alerts&appid={$key}";
$oneCall = fetchJson($oneCallUrl);

$daily = [];
$current = null;

if (!empty($oneCall['daily'])) {
    // Use One Call for both current + 7-day forecast
    if (!empty($oneCall['current'])) {
        $c = $oneCall['current'];
        $current = [
            'city'      => $oneCall['timezone'] ?? '',
            'temp'      => round($c['temp']),
            'feels_like'=> round($c['feels_like']),
            'humidity'  => $c['humidity'],
            'condition' => $c['weather'][0]['main'] ?? '',
            'description'=> $c['weather'][0]['description'] ?? '',
            'icon'      => $c['weather'][0]['icon'] ?? '',
        ];
    }
    $days = array_slice($oneCall['daily'], 0, 7);
    foreach ($days as $d) {
        $daily[] = [
            'date'      => date('Y-m-d', $d['dt']),
            'temp'      => round(($d['temp']['day'] ?? $d['temp']['max'])),
            'temp_min'  => round($d['temp']['min']),
            'temp_max'  => round($d['temp']['max']),
            'desc'      => $d['weather'][0]['description'] ?? '',
            'condition' => $d['weather'][0]['main'] ?? '',
        ];
    }
}

// Fallback: 5-day / 3-hour forecast aggregated to daily + current weather call
if (empty($daily)) {
    $currentUrl = "https://api.openweathermap.org/data/2.5/weather?lat={$lat}&lon={$lon}&units=metric&appid={$key}";
    $forecastUrl = "https://api.openweathermap.org/data/2.5/forecast?lat={$lat}&lon={$lon}&units=metric&appid={$key}";
    $cur = fetchJson($currentUrl);
    $fct = fetchJson($forecastUrl);

    if (!empty($cur) && empty($cur['error']) && ($cur['cod'] ?? 200) == 200) {
        $current = [
            'city'      => $cur['name'],
            'temp'      => round($cur['main']['temp']),
            'feels_like'=> round($cur['main']['feels_like']),
            'humidity'  => $cur['main']['humidity'],
            'condition' => $cur['weather'][0]['main'] ?? '',
            'description'=> $cur['weather'][0]['description'] ?? '',
            'icon'      => $cur['weather'][0]['icon'] ?? '',
        ];
    }
    if (!empty($fct['list'])) {
        $map = [];
        foreach ($fct['list'] as $item) {
            $date = explode(' ', $item['dt_txt'])[0];
            if (!isset($map[$date])) {
                $map[$date] = [
                    'date'      => $date,
                    'temp'      => round($item['main']['temp']),
                    'temp_min'  => round($item['main']['temp_min']),
                    'temp_max'  => round($item['main']['temp_max']),
                    'desc'      => $item['weather'][0]['description'],
                    'condition' => $item['weather'][0]['main'],
                ];
            }
        }
        $daily = array_slice(array_values($map), 0, 7);
    }
}

if (empty($current)) {
    apiResponse(false, 'Weather service unavailable. Check API key / network.', ['detail' => $oneCall]);
}

apiResponse(true, '', [
    'current'  => $current,
    'forecast' => $daily, // up to 7 days
]);
