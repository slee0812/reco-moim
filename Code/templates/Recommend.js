let miomDescription = ""; // 전역 변수로 선언

document.addEventListener("DOMContentLoaded", async () => {
  // 각 기능을 초기화하는 함수 호출
  await initializeMeetingName();
  await displayInitialMeetingInfo(); // 추가 정보 창에 모임 정보 출력
  initializeMap();
  initializeMapControls();
  await initializeMeetingDetails();
});

// 추가 정보 창에 모임 정보 출력
async function displayInitialMeetingInfo() {
  const urlParams = new URLSearchParams(window.location.search);
  const meetingName = urlParams.get("meeting_name");

  if (!meetingName) return;

  try {
    const response = await fetch(
      `/get-basic-meeting-info/${encodeURIComponent(meetingName)}`
    );
    if (!response.ok) {
      throw new Error("모임 정보를 가져오는 데 실패했습니다.");
    }
    const meetingDetails = await response.json();
    if (meetingDetails.error) {
      alert(meetingDetails.error);
      return;
    }

    const infoBox = document.getElementById("info-box");
    miomDescription = meetingDetails.description; // 전역 변수에 할당
    infoBox.innerHTML = `
      <p><strong>모임 설명:</strong> ${meetingDetails.description}</p>
      <p><strong>날짜:</strong> ${meetingDetails.date}</p>
      <p><strong>시간:</strong> ${meetingDetails.time}</p>
      <p><strong>참여 인원:</strong> ${meetingDetails.friends.join(", ")}</p>
    `;
  } catch (error) {
    console.error("Error fetching initial meeting info:", error);
  }
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
let lastFetchTime = null;
const CACHE_LIFETIME = 60 * 60 * 1000; // 1시간

async function initializeMeetingDetails() {
  const currentTime = new Date().getTime();

  // 마지막 데이터 가져온 시간이 1시간 이내이면 캐시된 데이터를 사용
  if (lastFetchTime && currentTime - lastFetchTime < CACHE_LIFETIME) {
    return cachedMeetingDetails;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const meetingName = urlParams.get("meeting_name") || "모임 이름 없음";

  let meetingDetails = {};
  try {
    const response = await fetch(
      `/get-meeting-details/${encodeURIComponent(meetingName)}`
    );
    if (response.ok) {
      meetingDetails = await response.json();
      cachedMeetingDetails = meetingDetails; // 캐시 저장
      lastFetchTime = currentTime; // 마지막 호출 시간 갱신
    }
  } catch (error) {
    console.error("Fetch Error:", error);
  }

  return meetingDetails;
}

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
      // 마크다운 처리 함수 정의
      function applyMarkdown(text) {
        return text
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // **bold**
          .replace(/__(.*?)__/g, "<em>$1</em>") // __italic__
          .replace(/### (.*?)\n/g, "<h2>$1</h2>") // ## Heading 2
          .replace(/## (.*?)\n/g, "<h1>$1</h1>") // # Heading 1
          .replace(/\n/g, "<br>"); // 줄바꿈
      }

      // 응답 텍스트를 ---로 구분
      var parts = response.response.split("---");
      var chatText = parts[0] || "";
      var infoText = parts[1] || "";
      var placeCoordinates = parts[2] || "";

      // AI 응답 마크다운 적용 및 줄바꿈 처리
      var formattedResponse = chatText
        .split("\n")
        .map(function (line) {
          return "<p>" + applyMarkdown(line) + "</p>";
        })
        .join("");

      $("#chat-messages").append(
        "<p><strong>AI:</strong></p>" + formattedResponse
      );

      // 추가 정보 상자에 정보 출력
      if (infoText.trim()) {
        var formattedInfo = infoText
          .split("\n")
          .map(function (line) {
            return "<p>" + applyMarkdown(line) + "</p>";
          })
          .join("");

        $("#info-box").html(formattedInfo);
      }
      return placeCoordinates;
    },
  });
}

// DOM 요소
const chatMessages = document.querySelector(".chat-messages");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const loadingElement = document.getElementById("loading");

// 지도 관련 변수
let map;
let userMarkers = []; // 사용자 마커를 저장할 배열 추가

// 지도 초기화
async function initializeMap() {
  // 사용자 위치 마커 표시
  await displayUserLocations();
}

// 사용자 위치 마커 표시 함수
async function displayUserLocations() {
  const urlParams = new URLSearchParams(window.location.search);
  const meetingName = urlParams.get("meeting_name");
  if (!meetingName) return;

  try {
    const response = await fetch(
      `/optimal-station/${encodeURIComponent(meetingName)}`
    );
    if (!response.ok) throw new Error("Failed to fetch meeting details");

    const data = await response.json();
    console.log(data);

    // 지도 첫설정
    const mapContainer = document.getElementById("map");
    const mapOption = {
      center: new kakao.maps.LatLng(
        data.center.latitude,
        data.center.longitude
      ),
      level: 7,
    };
    map = new kakao.maps.Map(mapContainer, mapOption);

    // 지도 컨트롤 추가
    const zoomControl = new kakao.maps.ZoomControl();
    const mapTypeControl = new kakao.maps.MapTypeControl();
    map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);
    map.addControl(mapTypeControl, kakao.maps.ControlPosition.TOPRIGHT);

    if (data.optimal_meeting_point) {
      optimalMeetingPoint = data.optimal_meeting_point.optimal_station; // 전역 변수에 저장
      console.log("Optimal Meeting Point:", optimalMeetingPoint);
    } else {
      console.error("Optimal meeting point not found in response data");
    }

    drawAllUserPaths(data);
    const friendDetails = data.friendDetails;
    const friends = data.friends;
    console.log("Friend Details:", friendDetails);

    const meetingInfoText = `모임장소: ${optimalMeetingPoint}\n
    모임설명: ${miomDescription}\n
    모임인원: ${friends.length}\n
    선호취향: ${friendDetails.positive_prompt.join(", ")}\n
    비선호취향: ${friendDetails.negative_prompt.join(", ")}\n
    위 조건에 맞는 모임장소를 추천해줘`;

    console.log("meetingInfoText:", meetingInfoText);

    // 챗봇의 메시지 작성란에 입력
    const messageInput = document.getElementById("user-input");
    if (messageInput) {
      messageInput.value = meetingInfoText;
    }
    // 기존 마커 제거
    userMarkers.forEach((marker) => marker.setMap(null));
    userMarkers = [];

    // 각 친구의 위치에 마커 생성
    if (friendDetails.coordinates && friendDetails.coordinates.length > 0) {
      friendDetails.coordinates.forEach((coord, index) => {
        const position = new kakao.maps.LatLng(coord.latitude, coord.longitude);
        const marker = new kakao.maps.Marker({
          position: position,
          map: map,
        });

        // 인포윈도우 생성
        const infowindow = new kakao.maps.InfoWindow({
          content: `<div style="padding:5px;">${friends[index]}</div>`,
        });

        // 마커 클릭 시 인포윈도우 표시
        kakao.maps.event.addListener(marker, "click", function () {
          infowindow.open(map, marker);
        });

        userMarkers.push(marker);
      });

      // 모든 마커가 보이도록 지도 범위 조정
      if (userMarkers.length > 0) {
        const bounds = new kakao.maps.LatLngBounds();
        userMarkers.forEach((marker) => bounds.extend(marker.getPosition()));
        map.setBounds(bounds);
      }
    }
  } catch (error) {
    console.error("Error fetching meeting details:", error);
  }
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

//경로 색상 생성 함수
function generateRandomColor() {
  const rainbowColors = [
    "#FF0000", // 빨간색
    "#FF7F00", // 주황색
    "#FFFF00", // 노란색
    "#00FF00", // 초록색
    "#0000FF", // 파란색
    "#4B0082", // 남색
    "#9400D3", // 보라색
  ];

  return rainbowColors[Math.floor(Math.random() * rainbowColors.length)];
}

// 모든 사용자의 경로 표시
async function drawAllUserPaths(meetingDetails) {
  const friends = meetingDetails.friends;
  const coordinates = meetingDetails.friendDetails.coordinates;
  const destination = meetingDetails.optimal_meeting_point;
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
          <strong>${destination.optimal_station}</strong><br>
          목적지
      </div>`,
    map: map,
    position: destinationMarker.getPosition(),
  });

  for (let i = 0; i < friends.length; i++) {
    const userName = friends[i];
    const startPoint = coordinates[i];
    const color = generateRandomColor();
    if (meetingDetails.details[i]) {
      drawUserPath(meetingDetails.details[i], color, userName, startPoint);
    }
  }
}

// SVG 마커 이미지 생성 함수
function createMarkerImageSrc(color) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="35" viewBox="0 0 24 35">
      <path fill="${color}" d="M12 0C5.383 0 0 5.383 0 12c0 9 12 23 12 23s12-14 12-23c0-6.617-5.383-12-12-12z"/>
    </svg>
  `;

  const base64 = btoa(svg);
  return "data:image/svg+xml;base64," + base64;
}

// 사용자별 경로 그리기 함수
function drawUserPath(path, color, userName, startPoint) {
  let userMarkers = new Map(); // 사용자 마커를 저장할 Map
  let userPaths = new Map(); // 사용자 경로를 저장할 Map
  let userInfoWindows = new Map(); // 사용자 정보창을 저장할 Map

  if (userPaths.has(userName)) {
    userPaths.get(userName).forEach((line) => line.setMap(null));
  }

  const pathLines = [];

  // 마커 이미지 생성
  const markerSize = new kakao.maps.Size(24, 35);
  const markerImage = new kakao.maps.MarkerImage(
    createMarkerImageSrc(color),
    markerSize
  );

  const startMarker = new kakao.maps.Marker({
    position: new kakao.maps.LatLng(startPoint.latitude, startPoint.longitude),
    map: map,
    image: markerImage,
  });
  userMarkers.set(userName, startMarker);

  const infowindow = new kakao.maps.InfoWindow({
    content: `<div style="padding:5px;text-align:center;">
          <strong>${userName}</strong><br>
          소요시간: ${path.info.totalTime}분
      </div>`,
    map: map,
    position: startMarker.getPosition(),
    yAnchor: 1.5,
  });
  userInfoWindows.set(userName, infowindow);

  path.subPath.forEach((subPath) => {
    if (subPath.passStopList?.stations) {
      const linePath = subPath.passStopList.stations.map(
        (station) => new kakao.maps.LatLng(station.y, station.x)
      );

      const polyline = new kakao.maps.Polyline({
        path: linePath,
        strokeWeight: 8,
        strokeColor: color,
        strokeOpacity: 0.7,
      });

      polyline.setMap(map);
      pathLines.push(polyline);
    }
  });

  userPaths.set(userName, pathLines);
}
