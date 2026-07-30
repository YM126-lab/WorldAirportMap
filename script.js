// ===========================
// World Airport Map
// script.js
// ===========================

// 地図
const map = L.map("map", {
    worldCopyJump: true,
    minZoom: 2,
    maxBoundsViscosity: 1.0
}).setView([20, 0], 2);

map.setMaxBounds([
    [-80, -Infinity],
    [80, Infinity]
]);

// ダークモード用
let currentLayer;
let darkMode = false;

// 地図タイル
currentLayer = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    {
        subdomains: "abcd",
        maxZoom: 20,
        noWrap: false,
        attribution: "&copy; OpenStreetMap &copy; CARTO"
    }
).addTo(map);

// マーカークラスター
const markers = L.markerClusterGroup({
    disableClusteringAtZoom: 5
});

map.addLayer(markers);

// 検索用
const airports = [];

// 選択中空港用
function showSelectedAirport(lat, lon) {

    if (selectedAirportMarker) {
        map.removeLayer(selectedAirportMarker);
    }

    selectedAirportMarker = L.circleMarker(
        [lat, lon],
        {
            radius: 16,
            color: "#00FF00",
            fillColor: "#00FF00",
            fillOpacity: 0.2,
            weight: 3,
            interactive: false
        }
    ).addTo(map);

}

//時刻用
let clockInterval = null;

// 選択中空港用
let selectedAirportMarker = null;

// 航空路線用
const routes = [];

let routeLayer = L.layerGroup().addTo(map);

let currentAirportIata = null;

// 航空会社用
const airlines = {};

// 言語翻訳用
const translations = {

    ja: {
        title: "🌍 世界空港マップ",
        search: "検索",
        selectAirport: "空港を選択してください",
        darkMode: "🌙 ダークモード",
        largeAirport: "大規模空港",
        mediumAirport: "中規模空港",
        smallAirport: "小規模空港",
        allCountries: "すべての国",
        showRoutes: "✈ 航路表示"
    },


    en: {
        title: "🌍 World Airport Map",
        search: "Search",
        selectAirport: "Select an airport",
        darkMode: "🌙 Dark Mode",
        largeAirport: "Large Airport",
        mediumAirport: "Medium Airport",
        smallAirport: "Small Airport",
        allCountries: "All Countries",
        showRoutes: "✈ Show Routes"
    }

};

// 天気用
function getWeatherName(code) {

    const weatherCodes = {
        0: "Clear Sky",
        1: "Mainly Clear",
        2: "Partly Cloudy",
        3: "Cloudy",
        45: "Fog",
        48: "Depositing Rime Fog",
        51: "Light Drizzle",
        61: "Rain",
        71: "Snow",
        80: "Rain Showers",
        95: "Thunderstorm"
    };

    return weatherCodes[code] || "Unknown";
};



// ===========================
// CSV読み込み
// ===========================

Papa.parse("data/airlines.dat", {

    download: true,

    complete: function(results) {

        results.data.forEach(row => {

            if (!row[3]) return;

            airlines[row[3]] = row[1];

        });

        console.log("Airlines Loaded");
        console.log(Object.keys(airlines).length);

        console.log("VS =", airlines["VS"]);
        console.log("NH =", airlines["NH"]);
        console.log("JL =", airlines["JL"]);

    }

});

Papa.parse("data/airports.csv", {
    download: true,
    header: true,
    skipEmptyLines: true,

    complete: function (results) {

        results.data.forEach(row => {

            if (!row.ident) return;

            const icao = row.ident;
            const type = row.type;
            // 重いデータを除外
            if (
                type === "heliport" ||
                type === "closed" ||
                type === "balloonport"
            ) {
                return;
            }
            const name = row.name;
            const lat = parseFloat(row.latitude_deg);
            const lon = parseFloat(row.longitude_deg);
            const elevation = row.elevation_ft;
            const country = row.iso_country;
            const region = row.iso_region;
            const city = row.municipality;
            const iata = row.iata_code;
            const gps = row.gps_code;
            const local = row.local_code;
            const home = row.home_link;
            const wikipedia = row.wikipedia_link;

            if (isNaN(lat) || isNaN(lon)) return;

            // 色・サイズ

            let color = "gray";
            let radius = 3;

            switch (type) {

                case "large_airport":
                    color = "red";
                    radius = 9;
                    break;

                case "medium_airport":
                    color = "orange";
                    radius = 6;
                    break;

                case "small_airport":
                    color = "blue";
                    radius = 4;
                    break;

                case "heliport":
                    color = "green";
                    radius = 3;
                    break;

                case "seaplane_base":
                    color = "purple";
                    radius = 4;
                    break;

                case "balloonport":
                    color = "black";
                    radius = 4;
                    break;

                case "closed":
                    color = "gray";
                    radius = 2;
                    break;
            }

            // マーカー

            const marker = L.circleMarker([lat, lon], {
                radius: radius,
                color: color,
                fillColor: color,
                fillOpacity: 0.9,
                weight: 1
            });

            // Popup

            let popup = `
                <h3>${name}</h3>

                <b>ICAO</b> : ${icao}<br>
                <b>IATA</b> : ${iata || "-"}<br>
                <b>GPS</b> : ${gps || "-"}<br>
                <b>Local</b> : ${local || "-"}<br><br>

                <b>Country</b> : ${country}<br>
                <b>Region</b> : ${region}<br>
                <b>City</b> : ${city || "-"}<br><br>

                <b>Type</b> : ${type}<br>
                <b>Elevation</b> : ${elevation || "-"} ft
            `;

            if (wikipedia) {
                popup += `
                    <br><br>
                    ${wikipedia}
                        📖 Wikipedia
                    </a>
                `;
            }

            if (home) {
                popup += `
                    <br>
                    ${home}
                        🌐 Official Website
                    </a>
                `;
            }

       marker.on("click", (e) => {

    L.DomEvent.stopPropagation(e);

    currentAirportIata = iata;

    showSelectedAirport(lat, lon);

    if (document.getElementById("showRoutesCheck").checked) {

        showRoutes(iata);

    } else {

        routeLayer.clearLayers();

    }

    const routeCount =
        routes.filter(r => r.source === iata).length;

    const destinationCount =
        new Set(
            routes
                .filter(r => r.source === iata)
                .map(r => r.destination)
        ).size;

    document.getElementById("airportInfo").innerHTML = `
<h2>${name}</h2>

<b>ICAO:</b> ${icao}<br>
<b>IATA:</b> ${iata || "-"}<br>
<b>GPS:</b> ${gps || "-"}<br>
<b>Local Code:</b> ${local || "-"}<br><br>

<b>Country:</b> ${country}<br>
<b>Region:</b> ${region}<br>
<b>City:</b> ${city || "-"}<br><br>

<b>Type:</b> ${type}<br>
<b>Elevation:</b> ${elevation || "-"} ft<br><br>

<b>Routes:</b> ${routeCount}<br>
<b>Destinations:</b> ${destinationCount}<br><br>

${wikipedia ?
`${wikipedia}<br>`
: ""}

${home ?
`${home}🌐 Official Website</a><br>`
: ""}
`;

fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`
)
.then(response => response.json())
.then(weather => {

    const temp =
        weather.current.temperature_2m;

    const weatherName =
        getWeatherName(
            weather.current.weather_code
        );

    const timezone =
        weather.timezone;

    function updateClock() {

    const localTime =
        new Date().toLocaleTimeString(
            "ja-JP",
            {
                timeZone: timezone,
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    const clockElement =
        document.getElementById("localTime");

    if (clockElement) {

        clockElement.textContent =
            "🕒 " + localTime;

    }

}

    document.getElementById("airportInfo").innerHTML += `
        <br><br>

        <b>Current Weather</b><br>

        🌡 ${temp}°C<br>

        ☁ ${weatherName}<br>

        🕒 <span id="localTime"></span>
    `;

    updateClock();

if (clockInterval) {
    clearInterval(clockInterval);
}

clockInterval = setInterval(updateClock, 1000);

});
});
            markers.addLayer(marker);

            airports.push({
                name,
                city,
                country,
                iata,
                icao,
                type,
                lat,
                lon,
                marker
            });

        });

        const countryFilter =
    document.getElementById("countryFilter");

const countries = [
    ...new Set(
        airports.map(a => a.country)
    )
].sort();

countries.forEach(country => {

    const option =
        document.createElement("option");

    option.value = country;
    option.textContent = country;

    countryFilter.appendChild(option);

});
        console.log(`${airports.length} airports loaded`);

        console.log(`${airports.length} airports loaded`);

applyFilter();
updateMarkerSizes();

}
});


// ===========================
// 検索
// ===========================

document
    .getElementById("searchButton")
    .addEventListener("click", searchAirport);

document
    .getElementById("search")
    .addEventListener("keypress", function (e) {

        if (e.key === "Enter") {
            searchAirport();
        }

    });

function searchAirport() {

    const keyword = document
        .getElementById("search")
        .value
        .trim()
        .toLowerCase();

    if (keyword === "") return;

    const selectedCountry =
    document.getElementById("countryFilter").value;

    const results = airports.filter(a =>

    (
        (a.icao && a.icao.toLowerCase() === keyword) ||
        (a.iata && a.iata.toLowerCase() === keyword) ||
        (a.name && a.name.toLowerCase().includes(keyword)) ||
        (a.city && a.city.toLowerCase().includes(keyword))
    )

    &&

    (
        selectedCountry === "" ||
        a.country === selectedCountry
    )

)


    console.log(results);
    console.log(`${results.length} airports found`);
    document.getElementById("searchCount").textContent =
    `${results.length} airports found`;

    const resultsDiv = document.getElementById("results");

    resultsDiv.innerHTML = "";

    if (results.length === 0) {

        resultsDiv.innerHTML = "No airports found";
        return;

    }

    results.slice(0, 20).forEach(airport => {

    const item = document.createElement("div");

    item.textContent =
        `${airport.name} (${airport.iata || "-"} / ${airport.icao})`;

    item.style.padding = "5px";
    item.style.cursor = "pointer";
    item.style.borderBottom = "1px solid #ddd";

    item.addEventListener("click", () => {

        map.flyTo([airport.lat, airport.lon], 6);

        airport.marker.fire("click");

    });

    resultsDiv.appendChild(item);

});

}

function updateMarkerSizes() {

    const zoom = map.getZoom();

    airports.forEach(airport => {

        let radius;

        if (airport.type === "large_airport") {

    radius = Math.min(14, Math.max(4, zoom * 1.0));

} else if (airport.type === "medium_airport") {

    radius = Math.min(11, Math.max(3, zoom * 0.8));

} else {

    radius = Math.min(8, Math.max(2.5, zoom * 0.5));

}

        airport.marker.setRadius(radius);

    });

}

function applyFilter() {

    const showLarge =
        document.getElementById("large").checked;

    const showMedium =
        document.getElementById("medium").checked;

    const showSmall =
        document.getElementById("small").checked;

    markers.clearLayers();

    airports.forEach(airport => {

        let visible = false;

        if (
            airport.type === "large_airport" &&
            showLarge
        ) {
            visible = true;
        }

        if (
            airport.type === "medium_airport" &&
            showMedium
        ) {
            visible = true;
        }

        if (
            airport.type === "small_airport" &&
            showSmall
        ) {
            visible = true;
        }

        if (visible) {
            markers.addLayer(airport.marker);
        }

    });

}
document
    .getElementById("large")
    .addEventListener("change", applyFilter);

document
    .getElementById("medium")
    .addEventListener("change", applyFilter);

document
    .getElementById("small")
    .addEventListener("change", applyFilter);

map.on("zoomend", updateMarkerSizes);

// 地図の何もない場所をクリックしたら詳細をリセット
map.on("click", () => {

    console.log("MAP CLICK");
    console.log(selectedAirportMarker);

    if (selectedAirportMarker) {
        map.removeLayer(selectedAirportMarker);
        selectedAirportMarker = null;
    }

    currentAirportIata = null;

    routeLayer.clearLayers();

    document.getElementById("airportInfo").innerHTML =
        "Select an airport";

});
document
    .getElementById("themeButton")
    .addEventListener("click", () => {

        map.removeLayer(currentLayer);

        if (!darkMode) {

            currentLayer = L.tileLayer(
                "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
                {
                    subdomains: "abcd",
                    maxZoom: 20
                }
            ).addTo(map);

            document.getElementById("themeButton").textContent =
                "☀ Light Mode";

            darkMode = true;

        } else {

            currentLayer = L.tileLayer(
                "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                {
                    maxZoom: 19,
                    attribution: "&copy; OpenStreetMap"
                }
            ).addTo(map);

            document.getElementById("themeButton").textContent =
                "🌙 Dark Mode";

            darkMode = false;
        }

    });

Papa.parse("data/routes.dat", {

    download: true,

    complete: function(results) {

        results.data.forEach(route => {

        
            routes.push({
    airline: route[0],
    source: route[2],
    destination: route[4],
    aircraft: route[8]
});

        });

        console.log("Routes Loaded");
        console.log(routes.length);

    }

});

function showRoutes(iata) {

    routeLayer.clearLayers();

    const displayedRoutes = new Set();

    const airportRoutes =
        routes.filter(r => r.source === iata);

    airportRoutes.slice(0, 200).forEach(route => {

    const routeKey =
        `${route.source}-${route.destination}`;

    if (displayedRoutes.has(routeKey)) {
    return;
}

displayedRoutes.add(routeKey);

const from =
    airports.find(a => a.iata === route.source);

const to =
    airports.find(a => a.iata === route.destination);

if (!from || !to) return;

const distanceKm =
    map.distance(
        [from.lat, from.lon],
        [to.lat, to.lon]
    ) / 1000;

const flightTimeHours =
    distanceKm / 850;

const hours =
    Math.floor(flightTimeHours);

const minutes =
    Math.round(
        (flightTimeHours - hours) * 60
    );

// 高緯度路線は被ばく量を多めにする
let doseFactor;

if (distanceKm < 1500)
    doseFactor = 0.005;
else if (distanceKm < 5000)
    doseFactor = 0.006;
else if (distanceKm < 10000)
    doseFactor = 0.007;
else
    doseFactor = 0.008;

if (
    Math.abs(from.lat) > 50 ||
    Math.abs(to.lat) > 50
) {
    doseFactor *= 1.2;
}

const dose =
    distanceKm * doseFactor;

let doseLevel;

if (dose < 10)
    doseLevel = "🟢 Low";
else if (dose < 50)
    doseLevel = "🟡 Moderate";
else
    doseLevel = "🔴 High";

const routeLine = new L.Geodesic(
    [
        [
            [from.lat, from.lon],
            [to.lat, to.lon]
        ]
    ],
    {
        color: "#0033CC",
        weight: 3,
        opacity: 0.85,
        steps: 150
    }
);

const airlinesOnRoute =
    airportRoutes
        .filter(r =>
            r.source === route.source &&
            r.destination === route.destination
        )
        .map(r =>
            airlines[r.airline] || r.airline
        );

const uniqueAirlines =
    [...new Set(airlinesOnRoute)];

const airlineAircraftList =
    uniqueAirlines
        .map(airlineName => {

            const aircrafts =
                [...new Set(
                    airportRoutes
                        .filter(r =>
                            r.source === route.source &&
                            r.destination === route.destination &&
                            (airlines[r.airline] || r.airline) === airlineName
                        )
                        .flatMap(r =>
                            (r.aircraft || "").split(" ")
                        )
                )]
                .filter(Boolean);

            return `
                <b>${airlineName}</b><br>
                • ${aircrafts.join("<br>• ")}
            `;
        })
        .join("<br><br>");

routeLine.bindPopup(`
    <h3>✈ Flight Route</h3>

    <b>Departure:</b><br>
    ${from.name} (${from.iata || from.icao})

    <br><br>

    <b>Arrival:</b><br>
    ${to.name} (${to.iata || to.icao})

    <br><br>

    <b>Distance:</b><br>
    ${distanceKm.toFixed(0)} km

    <br><br>

    <b>Flight Time:</b><br>
    ${hours}h ${minutes}m

    <br><br>

   <b>Radiation Dose:</b><br>
${dose.toFixed(1)} μSv

<br><br>

<b>Exposure Level:</b><br>
${doseLevel}

<br><br>

    <b>Airlines (${uniqueAirlines.length})</b>

    <br><br>

    ${airlineAircraftList}
`);

routeLayer.addLayer(routeLine);

L.circleMarker(
    [to.lat, to.lon],
    {
        radius: 6,
        color: "#0033CC",
        fillColor: "#0033CC",
        fillOpacity: 1
    }
).addTo(routeLayer);

    });

} // ← showRoutes(iata) の終了


function changeLanguage(lang) {

    const t = translations[lang];

    document.getElementById("title").textContent =
        t.title;

    document.getElementById("searchButton").textContent =
        t.search;

    document.getElementById("airportInfo").textContent =
        t.selectAirport;

    document.getElementById("themeButton").textContent =
    t.darkMode;

     document.getElementById("largeLabel").lastChild.textContent =
    " " + t.largeAirport;

     document.getElementById("mediumLabel").lastChild.textContent =
    " " + t.mediumAirport;

     document.getElementById("smallLabel").lastChild.textContent =
    " " + t.smallAirport;

     document.getElementById("showRoutesLabel")
    .lastChild.textContent =
    " " + t.showRoutes;

    document.getElementById("allCountriesOption")
    .textContent = t.allCountries;
}

document
    .getElementById("languageSelect")
    .addEventListener("change", function() {

        changeLanguage(this.value);

    });

changeLanguage("en");

document
    .getElementById("showRoutesCheck")
    .addEventListener("change", function () {

        if (this.checked) {

            if (currentAirportIata) {

                showRoutes(currentAirportIata);

            }

        } else {

            routeLayer.clearLayers();

        }

    });
