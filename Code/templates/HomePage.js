const termsCheckbox = document.getElementById("terms-checkbox");
const createCardButton = document.getElementById("create-preferences-card");
const createMeetingButton = document.getElementById("create-meeting-button");

// 초기 상태: 버튼 비활성화
createCardButton.classList.add("disabled");
createMeetingButton.classList.add("disabled");

// 체크박스 상태에 따라 버튼 활성화/비활성화
termsCheckbox.addEventListener("change", function () {
  if (this.checked) {
    createCardButton.classList.remove("disabled"); // 버튼 활성화
    createMeetingButton.classList.remove("disabled"); // 버튼 활성화
  } else {
    createCardButton.classList.add("disabled"); // 버튼 비활성화
    createMeetingButton.classList.add("disabled"); // 버튼 비활성화
  }
});

// "개인 취향 카드 만들기" 버튼 클릭 이벤트
createCardButton.addEventListener("click", function () {
  if (createCardButton.classList.contains("disabled")) {
    alert("약관에 동의하신 후 이용하실 수 있습니다.");
    return;
  }

  const userConfirmed = confirm(
    "개인 취향 카드 만들기 페이지로 이동합니다. 계속하시겠습니까?"
  );

  if (userConfirmed) {
    window.location.href = "CreatePreferences.html";
  }
});

// "모임 만들기" 버튼 클릭 이벤트
createMeetingButton.addEventListener("click", function () {
  if (createMeetingButton.classList.contains("disabled")) {
    alert("약관에 동의하신 후 이용하실 수 있습니다.");
    return;
  }

  const userConfirmed = confirm(
    "모임 만들기 페이지로 이동합니다. 계속하시겠습니까?"
  );

  if (userConfirmed) {
    window.location.href = "CreateMeeting.html";
  }
});
