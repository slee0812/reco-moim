const urlParams = new URLSearchParams(window.location.search);
const meetingName = urlParams.get("name");
const meetingDate = urlParams.get("date");
const meetingTime = urlParams.get("time");
const invitedFriends = urlParams.get("invitedFriends");
const chatMessages = document.querySelector('.chat-messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

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
const memberCountInput = document.getElementById("memberCount");
if (memberCountInput) {
  memberCountInput.addEventListener("change", function () {
    if (this.value < 2) this.value = 2;
  });
}

function addMessage(message) {
  const messageElement = document.createElement('div');
  messageElement.className = 'chat-message';
  messageElement.textContent = message;

  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendButton.addEventListener('click', () => {
  const message = messageInput.value.trim();
  if (message) {
    addMessage(message);
    messageInput.value = '';
  }
});

messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendButton.click();
  }
});
