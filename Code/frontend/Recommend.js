document.addEventListener("DOMContentLoaded", async () => {
  // 1. URL에서 모임 이름 가져오기
  const urlParams = new URLSearchParams(window.location.search);
  const meetingName = urlParams.get("meeting_name") || "모임 이름 없음";

  // 모임 이름을 왼쪽 상자에 표시
  const meetingNameElement = document.getElementById("meeting-name");
  meetingNameElement.textContent = meetingName;

  // 2. 모임 정보 가져오기 및 저장
  let meetingDetails = {};
  try {
    const response = await fetch(`/get-meeting-details/${encodeURIComponent(meetingName)}`);
    if (response.ok) {
      meetingDetails = await response.json();
      console.log("Meeting Details:", meetingDetails);
    } else {
      console.error("Error fetching meeting details");
    }
  } catch (error) {
    console.error("Fetch Error:", error);
  }

  // 3. 모임 정보 팝업 표시 기능
  let isPopupVisible = false; // 팝업 상태
  meetingNameElement.addEventListener("click", () => {
    if (!isPopupVisible) {
      showPopup(meetingDetails);
      isPopupVisible = true;
    } else {
      hidePopup();
      isPopupVisible = false;
    }
  });
});

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
    <p><strong>참여 친구들:</strong> ${details.friends?.join(", ") || "정보 없음"}</p>
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
    <p><strong>위치:</strong> ${friendDetails.location?.join(", ") || "정보 없음"}</p>
    <p><strong>선호 조건:</strong> ${friendDetails.positive_prompt?.join(", ") || "정보 없음"}</p>
    <p><strong>제외 조건:</strong> ${friendDetails.negative_prompt?.join(", ") || "정보 없음"}</p>
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

// 페이지 초기화
document.addEventListener("DOMContentLoaded", function () {
  initializeMeetingInfo();
  initializeMap();
  initializeMapControls();
  loadPlaces();
  initializeChatHandlers();
});


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

// 인원 수 입력 제한 설정
const memberCountInput = document.getElementById("memberCount");
if (memberCountInput) {
  memberCountInput.addEventListener("change", function () {
    if (this.value < 2) this.value = 2;
  });
}
