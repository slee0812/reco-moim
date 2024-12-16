const urlParams = new URLSearchParams(window.location.search);
const meetingName = urlParams.get("name");
const meetingDate = urlParams.get("date");
const meetingTime = urlParams.get("time");
const invitedFriends = urlParams.get("invitedFriends");

if (meetingName && meetingDate && meetingTime) {
  // 모임 이름 업데이트
  const meetingNameElement = document.getElementById("meeting-name");
  if (meetingNameElement) {
    meetingNameElement.textContent = meetingName;
  }

  // 모임 상세 정보 업데이트
  const meetingDetailsElement = document.getElementById("meeting-details");
  if (meetingDetailsElement) {
    meetingDetailsElement.innerHTML = `
      <p>날짜: ${meetingDate}</p>
      <p>시간: ${meetingTime}</p>
    `;
  }

  // 친구 목록 업데이트
  const friendsContainer = document.getElementById("friends-container");
  if (friendsContainer) {
    const friendsArray = invitedFriends
      ? invitedFriends.split(",").map((friend) => friend.trim())
      : [];
    friendsContainer.innerHTML = friendsArray
      .map((friend) => `<span class="friend-box">${friend}</span>`)
      .join("");
  }
}

// 인원 수 입력 제한 설정
document.getElementById("memberCount").addEventListener("change", function () {
  if (this.value < 2) this.value = 2;
});
