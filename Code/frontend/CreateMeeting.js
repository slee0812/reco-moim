let selectedFriendNames = []; // 선택된 친구 이름 목록

// 친구 이름 목록 불러오기
document.getElementById("add-friend-button").addEventListener("click", async function () {
  const friendList = document.getElementById("friend-list");

  try {
    const response = await fetch("/get-friends-names");
    if (!response.ok) throw new Error("서버에서 친구 이름 데이터를 가져오지 못했습니다.");

    const data = await response.json();
    const names = data.names.filter(name => !selectedFriendNames.includes(name));

    friendList.innerHTML = "";
    if (names.length === 0) {
      friendList.innerHTML = "<div>모든 친구가 이미 추가되었습니다.</div>";
    } else {
      names.forEach(name => {
        const friendItem = document.createElement("div");
        friendItem.className = "friend-item";
        friendItem.textContent = name;

        // 클릭 시 친구 추가
        friendItem.addEventListener("click", function () {
          addFriendToSelection(name);
          friendList.style.display = "none";
        });

        friendList.appendChild(friendItem);
      });
    }
    friendList.style.display = "block";
  } catch (error) {
    console.error("친구 이름 불러오기 실패:", error);
    alert("친구 이름 목록을 불러오는 데 실패했습니다.");
  }
});

// 친구를 선택된 목록에 추가
function addFriendToSelection(name) {
  const selectedFriendsContainer = document.getElementById("selected-friends-container");

  if (!selectedFriendNames.includes(name)) {
    selectedFriendNames.push(name);

    const friendItem = document.createElement("span");
    friendItem.className = "selected-friend";
    friendItem.textContent = name;

    const removeButton = document.createElement("span");
    removeButton.className = "remove-friend";
    removeButton.textContent = "x";
    removeButton.addEventListener("click", function () {
      selectedFriendsContainer.removeChild(friendItem);
      selectedFriendNames = selectedFriendNames.filter(n => n !== name);
    });

    friendItem.appendChild(removeButton);
    selectedFriendsContainer.appendChild(friendItem);
  }
}

// 폼 및 선택된 친구 목록 초기화
function resetForm() {
  document.getElementById("filter-form").reset();
  document.getElementById("selected-friends-container").innerHTML = "";
  selectedFriendNames = [];
}


// 서버에서 저장된 모임 데이터 불러오기 및 화면에 표시
async function fetchAndDisplayMeetings() {
  try {
    const response = await fetch("/get-meetings");
    if (!response.ok) throw new Error("모임 데이터를 가져오지 못했습니다.");

    const meetings = await response.json();
    const resultsContainer = document.getElementById("results-container");
    resultsContainer.innerHTML = ""; // 기존 내용 초기화

    if (meetings.length === 0) {
      resultsContainer.innerHTML = "<div>저장된 모임이 없습니다.</div>";
    } else {
      meetings.forEach(meeting => {
        const meetingBox = document.createElement("div");
        meetingBox.className = "meeting-box";

        // 친구 이름을 카드 형식으로 표시
        const friendsHTML = meeting.friends.map(friend => `
          <div class="friend-card">${friend}</div>
        `).join("");

        meetingBox.innerHTML = `
        <a href="/recommend?meeting_name=${encodeURIComponent(meeting.name)}" style="text-decoration:none; color:inherit;">
          <div class="meeting-header">
            <h3>${meeting.name}</h3>
            <button class="delete-meeting" data-id="${meeting.id}" style="float:right;">x</button>
          </div>
          <p>설명: ${meeting.description}</p>
          <p>날짜: ${meeting.date}</p>
          <p>시간: ${meeting.time}</p>
          <div class="friends-container">${friendsHTML}</div>
        </a>
      `;
      
        resultsContainer.appendChild(meetingBox);
      });

      // 삭제 버튼 이벤트 리스너 추가
      document.querySelectorAll(".delete-meeting").forEach(button => {
        button.addEventListener("click", function () {
          const meetingId = this.getAttribute("data-id");
          deleteMeeting(meetingId);
        });
      });
    }
  } catch (error) {
    console.error("모임 데이터 불러오기 실패:", error);
  }
}


document.getElementById("filter-form").addEventListener("submit", async function (e) {
  e.preventDefault();

  const meetingName = document.getElementById("meeting-name").value;
  const description = document.getElementById("meeting-description").value; // 설명 추가
  const date = document.getElementById("meeting-date").value;
  const time = document.getElementById("meeting-time").value;

  try {
    const response = await fetch("/create-meeting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: meetingName,
        description: description,
        date: date,
        time: time,
        friends: selectedFriendNames,
      }),
    });

    const result = await response.json();
    if (result.status === "success") {
      alert(result.message);
      resetForm();
      await fetchAndDisplayMeetings();
    } else {
      alert(result.message);
    }
  } catch (error) {
    console.error("모임 저장 실패:", error);
  }
});


// 모임 삭제
async function deleteMeeting(meetingId) {
  if (confirm("정말로 이 모임을 삭제하시겠습니까?")) {
    try {
      const response = await fetch(`/delete-meeting/${meetingId}`, { method: "DELETE" });
      const result = await response.json();
      if (result.status === "success") {
        alert(result.message);
        await fetchAndDisplayMeetings(); // 삭제 후 데이터 갱신
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("모임 삭제 실패:", error);
      alert("모임 삭제 중 오류가 발생했습니다.");
    }
  }
}


// 페이지 로드 시 모임 데이터를 불러오고 표시
document.addEventListener("DOMContentLoaded", async function () {
  await fetchAndDisplayMeetings(); // 페이지 로드 시 모임 데이터 표시
});