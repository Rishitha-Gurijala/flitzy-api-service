const socket = io();

mapGeneration();

function mapGeneration() {
    const map = L.map("map").setView([0, 0], 10);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "OpenStreetMap"
    }).addTo(map);

    const markers = {};
    L.Routing.control({
        waypoints: [
            L.latLng(13.040318130491162, 77.66392292145053),
            L.latLng(13.037777265487227, 77.65001535415651)
        ]
    }).on('routesfound', function (e) {
        console.log("totalDistance :::", e.routes[0].summary.totalDistance);
        console.log("totalTime :::", e.routes[0].summary.totalTime);
    }).addTo(map);
}

