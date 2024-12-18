// URL 파라미터 처리
const urlParams = new URLSearchParams(window.location.search);
const meetingName = urlParams.get("name");
const meetingDate = urlParams.get("date");
const meetingTime = urlParams.get("time");
const invitedFriends = urlParams.get("invitedFriends");

// DOM 요소
const chatMessages = document.querySelector(".chat-messages");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const loadingElement = document.getElementById("loading");
const routeOptionsContainer = document.getElementById("route-options");

// 지도 관련 변수
let map;
let clusterer;
let userMarker = null;
let startMarker = null;
let endMarker = null;
let pathLines = [];
let currentInfoWindow = null;

// 경로 색상 정의
const PATH_COLORS = {
    WALK: '#808080',    // 도보 - 회색
    SUBWAY: '#3cb44b',  // 지하철 - 초록색
    BUS: '#4363d8'      // 버스 - 파란색
};

// 페이지 초기화
document.addEventListener("DOMContentLoaded", function () {
    initializeMeetingInfo();
    initializeMap();
    initializeMapControls();
    loadPlaces();
    initializeChatHandlers();
});

// 모임 정보 초기화
function initializeMeetingInfo() {
    if (meetingName && meetingDate && meetingTime) {
        const meetingNameElement = document.getElementById("meeting-name");
        if (meetingNameElement) {
            meetingNameElement.textContent = meetingName;
        }

        const meetingDetailsElement = document.getElementById("meeting-details");
        if (meetingDetailsElement) {
            meetingDetailsElement.innerHTML = `
                <p>날짜: ${meetingDate}</p>
                <p>시간: ${meetingTime}</p>
            `;
        }

        const friendsContainer = document.getElementById("friends-container");
        if (friendsContainer && invitedFriends) {
            const friendsArray = invitedFriends.split(",").map(friend => friend.trim());
            friendsContainer.innerHTML = friendsArray
                .map(friend => `<span class="friend-box">${friend}</span>`)
                .join("");
        }
    }
}

// 지도 초기화
function initializeMap() {
    const mapContainer = document.getElementById("map");
    const mapOption = {
        center: new kakao.maps.LatLng(37.5666805, 126.9784147),
        level: 6
    };
    map = new kakao.maps.Map(mapContainer, mapOption);

    // 클러스터러 초기화
    clusterer = new kakao.maps.MarkerClusterer({
        map: map,
        averageCenter: true,
        minLevel: 4,
        disableClickZoom: true,
        gridSize: 60
    });

    // 지도 클릭 이벤트 등록
    kakao.maps.event.addListener(map, 'click', handleMapClick);

    // 지도 컨트롤 추가
    const zoomControl = new kakao.maps.ZoomControl();
    const mapTypeControl = new kakao.maps.MapTypeControl();
    map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);
    map.addControl(mapTypeControl, kakao.maps.ControlPosition.TOPRIGHT);
}

// 지도 컨트롤 초기화
function initializeMapControls() {
    const currentLocationBtn = document.getElementById("current-location");
    const resetPathBtn = document.getElementById("reset-path");

    currentLocationBtn.addEventListener("click", getCurrentLocation);
    resetPathBtn.addEventListener("click", resetPath);
}

// 현재 위치 가져오기
function getCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function (position) {
                const userPosition = new kakao.maps.LatLng(
                    position.coords.latitude,
                    position.coords.longitude
                );

                if (userMarker) {
                    userMarker.setMap(null);
                }

                userMarker = new kakao.maps.Marker({
                    position: userPosition,
                    map: map,
                    image: new kakao.maps.MarkerImage(
                        "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png",
                        new kakao.maps.Size(31, 35),
                        { offset: new kakao.maps.Point(15, 35) }
                    )
                });

                map.setCenter(userPosition);
                addMessage("현재 위치를 가져왔습니다.");
            },
            function (error) {
                console.error("위치 정보를 가져오는데 실패했습니다.", error);
                alert("위치 정보를 가져오는데 실패했습니다.");
            }
        );
    } else {
        alert("이 브라우저에서는 위치 정보를 사용할 수 없습니다.");
    }
}

// 지도 클릭 이벤트 핸들러
function handleMapClick(mouseEvent) {
    const latlng = mouseEvent.latLng;

    if (!startMarker) {
        // 출발지 마커 생성
        startMarker = new kakao.maps.Marker({
            position: latlng,
            map: map
        });
        addMessage("출발지가 설정되었습니다. 도착지를 선택해주세요.");
    } else if (!endMarker) {
        // 도착지 마커 생성
        endMarker = new kakao.maps.Marker({
            position: latlng,
            map: map
        });
        
        // 경로 검색
        findPath(
            startMarker.getPosition().getLng(),
            startMarker.getPosition().getLat(),
            latlng.getLng(),
            latlng.getLat()
        );
    }
}

// 경로 검색
async function findPath(startX, startY, endX, endY) {
    showLoading();
    try {
        const response = await fetch(
            `/find-path?sx=${startX}&sy=${startY}&ex=${endX}&ey=${endY}`
        );
        const data = await response.json();

        if (data.result && data.result.path) {
            displayRouteOptions(data.result.path);
        } else {
            addMessage("경로를 찾을 수 없습니다.");
        }
    } catch (error) {
        console.error("Error finding path:", error);
        addMessage("경로 검색 중 오류가 발생했습니다.");
    } finally {
        hideLoading();
    }
}

// 경로 옵션 표시
function displayRouteOptions(paths) {
    routeOptionsContainer.innerHTML = '';
    paths.forEach((path, index) => {
        const option = createRouteOption(path, index);
        routeOptionsContainer.appendChild(option);
    });
}

// 경로 옵션 요소 생성
function createRouteOption(path, index) {
    const option = document.createElement('div');
    option.className = 'route-option';
    option.innerHTML = `
        <div class="route-summary">
            <strong>경로 ${index + 1}</strong> - ${path.info.totalTime}분 / ${path.info.payment}원
        </div>
        <div class="route-details">
            ${createTransportTypeIndicators(path.subPath)}
        </div>
    `;
    option.addEventListener('click', () => selectRoute(path, index));
    return option;
}

// 교통수단 타입 표시기 생성
function createTransportTypeIndicators(subPaths) {
    return subPaths.map(subPath => {
        let className, text;
        switch(subPath.trafficType) {
            case 1:
                className = 'transport-subway';
                text = '지하철';
                break;
            case 2:
                className = 'transport-bus';
                text = '버스';
                break;
            case 3:
                className = 'transport-walk';
                text = '도보';
                break;
            default:
                return '';
        }
        return `<span class="transport-type-indicator ${className}">${text}</span>`;
    }).join('');
}

// 경로 선택
function selectRoute(path, index) {
    clearPathLines();
    drawPath(path);
    updateRouteSelection(index);
    displayRouteInfo(path);
}

// 경로 그리기
function drawPath(path) {
    path.subPath.forEach(subPath => {
        if (subPath.passStopList && subPath.passStopList.stations) {
            const linePath = subPath.passStopList.stations.map(station => 
                new kakao.maps.LatLng(station.y, station.x)
            );

            let color;
            switch(subPath.trafficType) {
                case 1: color = PATH_COLORS.SUBWAY; break;
                case 2: color = PATH_COLORS.BUS; break;
                case 3: color = PATH_COLORS.WALK; break;
            }

            const polyline = new kakao.maps.Polyline({
                path: linePath,
                strokeWeight: 5,
                strokeColor: color,
                strokeOpacity: 0.7
            });

            polyline.setMap(map);
            pathLines.push(polyline);

            // 정류장/역 마커 추가
            subPath.passStopList.stations.forEach(station => {
                const marker = new kakao.maps.Marker({
                    position: new kakao.maps.LatLng(station.y, station.x),
                    map: map
                });

                const infowindow = new kakao.maps.InfoWindow({
                    content: `
                        <div class="info-window">
                            <strong>${station.stationName}</strong>
                        </div>
                    `
                });

                kakao.maps.event.addListener(marker, 'click', function() {
                    if (currentInfoWindow) {
                        currentInfoWindow.close();
                    }
                    infowindow.open(map, marker);
                    currentInfoWindow = infowindow;
                });
            });
        }
    });
}

// 경로 선택 상태 업데이트
function updateRouteSelection(selectedIndex) {
    const options = document.querySelectorAll('.route-option');
    options.forEach((option, index) => {
        option.classList.toggle('selected', index === selectedIndex);
    });
}

// 경로 정보 표시
function displayRouteInfo(path) {
    const info = path.info;
    addMessage(`
        선택된 경로 정보:
        총 소요시간: ${info.totalTime}분
        총 거리: ${info.totalDistance}m
        요금: ${info.payment}원
        도보거리: ${info.totalWalk}m
    `);
}

// 경로 초기화
function resetPath() {
    if (startMarker) {
        startMarker.setMap(null);
        startMarker = null;
    }
    if (endMarker) {
        endMarker.setMap(null);
        endMarker = null;
    }
    clearPathLines();
    routeOptionsContainer.innerHTML = '';
    addMessage("경로가 초기화되었습니다.");
}

// 경로 라인 제거
function clearPathLines() {
    pathLines.forEach(line => line.setMap(null));
    pathLines = [];
}

// 장소 데이터 로드
async function loadPlaces() {
    showLoading();
    try {
        const placesResponse = await fetch("/places");
        const placesData = await placesResponse.json();

        const centroid = placesData.centroid;
        const centroidPosition = new kakao.maps.LatLng(
            centroid.latitude,
            centroid.longitude
        );
        map.setCenter(centroidPosition);

        const markers = placesData.documents.map((place) => {
            const marker = new kakao.maps.Marker({
                position: new kakao.maps.LatLng(place.y, place.x),
            });

            const infowindow = new kakao.maps.InfoWindow({
                content: `
                    <div class="info-window">
                        <strong>${place.place_name}</strong>
                        <p>${place.address_name}</p>
                    </div>
                `
            });

            kakao.maps.event.addListener(marker, 'click', function () {
                if (currentInfoWindow) {
                    currentInfoWindow.close();
                }
                infowindow.open(map, marker);
                currentInfoWindow = infowindow;
                addMessage(`추천 장소: ${place.place_name}\n주소: ${place.address_name}`);
            });

            return marker;
        });

        clusterer.addMarkers(markers);
    } catch (error) {
        console.error("Error loading places:", error);
        addMessage("장소 정보를 불러오는데 실패했습니다.");
    } finally {
        hideLoading();
    }
}

// 채팅 핸들러 초기화
function initializeChatHandlers() {
    sendButton.addEventListener("click", sendMessage);
    messageInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
            sendMessage();
        }
    });
}

// 메시지 전송
function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        addMessage(message);
        messageInput.value = "";
    }
}

// 메시지 추가
function addMessage(message) {
    const messageElement = document.createElement("div");
    messageElement.className = "chat-message";
    messageElement.textContent = message;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 로딩 표시 함수
function showLoading() {
    if (loadingElement) {
        loadingElement.style.display = "block";
    }
}

function hideLoading() {
    if (loadingElement) {
        loadingElement.style.display = "none";
    }
}