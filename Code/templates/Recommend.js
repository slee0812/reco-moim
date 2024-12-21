document.addEventListener("DOMContentLoaded", async () => {
  // 각 기능을 초기화하는 함수 호출
  await initializeMeetingName();
  await initializeMeetingDetails();
  initializeMap();
  initializeMapControls();
  loadPlaces();
  initializeChatHandlers();
  initializePopupToggle();
  initializeMeetingInfo();
});

function sendMessage() {
  var userMessage = $("#user-input").val();
  $("#chat-messages").append(
    "<p><strong>You:</strong> " + userMessage + "</p>"
  );
  $("#user-input").val("");

  $.ajax({
    url: "/chat",
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify({ message: userMessage }),
    success: function (response) {
      // AI 응답을 줄바꿈으로 분리
      var formattedResponse = response.response
        .split("\n")
        .map(function (line) {
          return "<p>" + line + "</p>";
        })
        .join("");

      $("#chat-messages").append(
        "<p><strong>AI:</strong></p>" + formattedResponse
      );

      // 인용 정보 표시
      if (response.citations && response.citations.length > 0) {
        var citationsHtml = "<p><strong>인용:</strong></p><ul>";
        response.citations.forEach(function (citation) {
          citationsHtml +=
            "<li>" + citation.content + " (출처: " + citation.source + ")</li>";
        });
        citationsHtml += "</ul>";
        $("#chat-messages").append(citationsHtml);
      }
    },
  });
}

// 1. URL에서 모임 이름 가져오기 및 모임 이름 표시
async function initializeMeetingName() {
  const urlParams = new URLSearchParams(window.location.search);
  const meetingName = urlParams.get("meeting_name") || "모임 이름 없음";

  // 모임 이름을 왼쪽 상자에 표시
  const meetingNameElement = document.getElementById("meeting-name");
  meetingNameElement.textContent = meetingName;
}

// 2. 모임 정보 가져오기 및 저장
async function initializeMeetingDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const meetingName = urlParams.get("meeting_name") || "모임 이름 없음";

  let meetingDetails = {};
  try {
    const response = await fetch(
      `/get-meeting-details/${encodeURIComponent(meetingName)}`
    );
    if (response.ok) {
      meetingDetails = await response.json();
      console.log("Meeting Details:", meetingDetails);

      // 새로운 기능 추가
      initializeRoutePanel();
      await drawAllUserPaths(meetingDetails);
    } else {
      console.error("Error fetching meeting details");
    }
  } catch (error) {
    console.error("Fetch Error:", error);
  }

  return meetingDetails;
}

// 3. 모임 정보 팝업 표시 기능
function initializePopupToggle() {
  let isPopupVisible = false; // 팝업 상태
  const meetingNameElement = document.getElementById("meeting-name");

  meetingNameElement.addEventListener("click", async () => {
    const meetingDetails = await initializeMeetingDetails(); // 모임 정보를 받아옴

    if (!isPopupVisible) {
      showPopup(meetingDetails);
      isPopupVisible = true;
    } else {
      hidePopup();
      isPopupVisible = false;
    }
  });
}

// 팝업 표시 함수
function showPopup(details) {
  const popup = document.createElement("div");
  popup.id = "meeting-popup";
  popup.style.position = "absolute";
  popup.style.top = "50px";
  popup.style.left = "20px";
  popup.style.background = "#ffffff";
  popup.style.border = "2px solid #28a745";
  popup.style.borderRadius = "10px";
  popup.style.padding = "15px";
  popup.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.3)";
  popup.style.zIndex = "1100";
  popup.style.maxWidth = "300px";

  popup.innerHTML = `
    <h3 style="color:#28a745; text-align:center;">모임 상세 정보</h3>
    <p><strong>설명:</strong> ${details.description || "정보 없음"}</p>
    <p><strong>날짜:</strong> ${details.date || "정보 없음"}</p>
    <p><strong>시간:</strong> ${details.time || "정보 없음"}</p>
    <p><strong>참여 친구들:</strong> ${
      details.friends?.join(", ") || "정보 없음"
    }</p>
  `;

  document.body.appendChild(popup);
}

// 팝업 숨기기 함수
function hidePopup() {
  const popup = document.getElementById("meeting-popup");
  if (popup) popup.remove();
}

// 정성준 수정 파트 종료
//meetingDetails.friends_details를 사용하여 친구 정보를 가져올 수 있음 나중에 코드를 gpt에 활용용

// 프롬프트 정보 업데이트 함수
function updatePromptInfo(friendDetails) {
  const promptContainer = document.getElementById("prompt");
  if (!promptContainer) return;

  promptContainer.innerHTML = `
    <h4>선호 및 제외 조건</h4>
    <p><strong>위치:</strong> ${
      friendDetails.location?.join(", ") || "정보 없음"
    }</p>
    <p><strong>선호 조건:</strong> ${
      friendDetails.positive_prompt?.join(", ") || "정보 없음"
    }</p>
    <p><strong>제외 조건:</strong> ${
      friendDetails.negative_prompt?.join(", ") || "정보 없음"
    }</p>
  `;
}

// DOM 요소
const chatMessages = document.querySelector(".chat-messages");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const loadingElement = document.getElementById("loading");

// 지도 관련 변수
let map;
let clusterer;
let userMarker = null;
let userMarkers = new Map(); // 사용자별 마커 저장
let userPaths = new Map(); // 사용자별 경로선 저장
let userInfoWindows = new Map(); // 사용자별 정보창 저장
const routePanel = document.createElement("div"); // 경로 정보 패널

// 지도 초기화
function initializeMap() {
  const mapContainer = document.getElementById("map");
  const mapOption = {
    center: new kakao.maps.LatLng(37.5666805, 126.9784147),
    level: 6,
  };
  map = new kakao.maps.Map(mapContainer, mapOption);

  // 클러스터러 초기화
  clusterer = new kakao.maps.MarkerClusterer({
    map: map,
    averageCenter: true,
    minLevel: 4,
    disableClickZoom: true,
    gridSize: 60,
  });

  // 지도 컨트롤 추가
  const zoomControl = new kakao.maps.ZoomControl();
  const mapTypeControl = new kakao.maps.MapTypeControl();
  map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);
  map.addControl(mapTypeControl, kakao.maps.ControlPosition.TOPRIGHT);
}

// 지도 컨트롤 초기화
function initializeMapControls() {
  // 현재 위치 버튼 생성
  const locationBtn = document.createElement("button");
  locationBtn.innerHTML = "내 위치";
  locationBtn.className = "custom-control";
  document.getElementById("map").appendChild(locationBtn);

  locationBtn.addEventListener("click", getCurrentLocation);
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
          ),
        });

        map.setCenter(userPosition);
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

// 장소 데이터 로드
async function loadPlaces() {
  showLoading();
  try {
    // 주변 장소와 중심점 가져오기
    const placesResponse = await fetch("/places");
    const placesData = await placesResponse.json();

    // 중심점 가져오기
    const centroid = placesData.centroid;
    const centroidPosition = new kakao.maps.LatLng(
      centroid.latitude,
      centroid.longitude
    );
    map.setCenter(centroidPosition);

    // 마커 생성
    const markers = placesData.documents.map((place) => {
      const marker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(place.y, place.x),
      });

      // 인포윈도우 생성
      const infowindow = new kakao.maps.InfoWindow({
        content: `
                      <div style="padding:5px;">
                          <strong>${place.place_name}</strong>
                          <p>${place.address_name}</p>
                      </div>
                  `,
      });

      // 클릭 이벤트 추가
      kakao.maps.event.addListener(marker, "click", function () {
        infowindow.open(map, marker);
        // 채팅창에 장소 정보 추가
        addMessage(
          `추천 장소: ${place.place_name}\n주소: ${place.address_name}`
        );
      });

      return marker;
    });

    // 클러스터러에 마커 추가
    clusterer.addMarkers(markers);
  } catch (error) {
    console.error("Error loading places:", error);
    alert("장소 정보를 불러오는데 실패했습니다.");
  } finally {
    hideLoading();
  }
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

// 인원 수 입력 제한 설정
const memberCountInput = document.getElementById("memberCount");
if (memberCountInput) {
  memberCountInput.addEventListener("change", function () {
    if (this.value < 2) this.value = 2;
  });
}
function generateRandomColor() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 50%)`;
}

// 경로 패널 초기화
function initializeRoutePanel() {
  routePanel.className = "route-panel";
  routePanel.style.cssText = `
      position: absolute;
      left: 10px;
      top: 10px;
      max-width: 300px;
      max-height: 80vh;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      overflow-y: auto;
      padding: 15px;
      z-index: 1;
  `;
  document.getElementById("map").appendChild(routePanel);
}

// 모든 사용자의 경로 표시
async function drawAllUserPaths(meetingDetails) {
  const friends = meetingDetails.friends;
  const coordinates = meetingDetails.friend_details.coordinates;
  const destination = meetingDetails.optimal_station_by_total;

  // 목적지 마커 생성
  const destinationMarker = new kakao.maps.Marker({
    position: new kakao.maps.LatLng(
      destination.latitude,
      destination.longitude
    ),
    map: map,
  });

  // 목적지 정보창
  new kakao.maps.InfoWindow({
    content: `<div style="padding:5px;text-align:center;">
          <strong>${destination.station_name}</strong><br>
          목적지
      </div>`,
    map: map,
    position: destinationMarker.getPosition(),
  });

  routePanel.innerHTML = '<h3 style="margin-bottom:15px;">경로 정보</h3>';

  for (let i = 0; i < friends.length; i++) {
    const userName = friends[i];
    const startPoint = coordinates[i];
    const color = generateRandomColor();

    const pathData = await findPath(
      startPoint.longitude,
      startPoint.latitude,
      destination.longitude,
      destination.latitude
    );

    if (pathData.result && pathData.result.path) {
      drawUserPath(pathData.result.path[0], color, userName, startPoint);
      addRouteInfo(userName, pathData.result.path[0], color);
    }
  }
}

// 경로 찾기 API 호출
async function findPath(startX, startY, endX, endY) {
  try {
    const response = await fetch(
      `/find-path?sx=${startX}&sy=${startY}&ex=${endX}&ey=${endY}`
    );
    return await response.json();
  } catch (error) {
    console.error("Error finding path:", error);
    return null;
  }
}

// 사용자별 경로 그리기
function drawUserPath(path, color, userName, startPoint) {
  if (userPaths.has(userName)) {
    userPaths.get(userName).forEach((line) => line.setMap(null));
  }

  const pathLines = [];

  const startMarker = new kakao.maps.Marker({
    position: new kakao.maps.LatLng(startPoint.latitude, startPoint.longitude),
    map: map,
  });
  userMarkers.set(userName, startMarker);

  const infowindow = new kakao.maps.InfoWindow({
    content: `<div style="padding:5px;text-align:center;">
          <strong>${userName}</strong><br>
          소요시간: ${path.info.totalTime}분
      </div>`,
    map: map,
    position: startMarker.getPosition(),
  });
  userInfoWindows.set(userName, infowindow);

  path.subPath.forEach((subPath) => {
    if (subPath.passStopList?.stations) {
      const linePath = subPath.passStopList.stations.map(
        (station) => new kakao.maps.LatLng(station.y, station.x)
      );

      const polyline = new kakao.maps.Polyline({
        path: linePath,
        strokeWeight: 5,
        strokeColor: color,
        strokeOpacity: 0.7,
      });

      polyline.setMap(map);
      pathLines.push(polyline);
    }
  });

  userPaths.set(userName, pathLines);
}

// 경로 패널에 정보 추가
function addRouteInfo(userName, path, color) {
  const userSection = document.createElement("div");
  userSection.className = "user-route-section";
  userSection.style.cssText = `
      margin-bottom: 15px;
      padding: 10px;
      border-radius: 5px;
      border-left: 4px solid ${color};
      background: #f8f9fa;
  `;

  userSection.innerHTML = `
      <h4 style="margin:0 0 10px 0">${userName}</h4>
      <p>총 소요시간: ${path.info.totalTime}분</p>
      <p>총 거리: ${path.info.totalDistance}m</p>
      <div class="route-details">
          ${path.subPath
            .map(
              (subPath) => `
              <div style="margin-top:5px">
                  ${getTransportTypeText(subPath.trafficType)}:
                  ${subPath.sectionTime}분
              </div>
          `
            )
            .join("")}
      </div>
  `;

  routePanel.appendChild(userSection);
}

// 교통수단 텍스트 반환
function getTransportTypeText(trafficType) {
  switch (trafficType) {
    case 1:
      return "지하철";
    case 2:
      return "버스";
    case 3:
      return "도보";
    default:
      return "기타";
  }
}
