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
    // 현재 URL에서 이름 정보 추출
    const urlParams = new URLSearchParams(window.location.search);
    const loggedInUserName = urlParams.get("name");

    if (loggedInUserName) {
      // 이름 정보를 포함하여 CreatePreferences 페이지로 이동
      window.location.href = `CreatePreferences.html?name=${encodeURIComponent(loggedInUserName)}`;
    } else {
      alert("로그인된 사용자 정보를 찾을 수 없습니다.");
    }
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
    // URL에서 로그인된 사용자 이름 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const loggedInUserName = urlParams.get("name");

    if (loggedInUserName) {
      // 이름 정보를 포함하여 CreateMeeting 페이지로 이동
      window.location.href = `CreateMeeting.html?name=${encodeURIComponent(loggedInUserName)}`;
    } else {
      alert("로그인된 사용자 정보를 찾을 수 없습니다.");
    }
  }
});

// 로그인 폼 위에 메시지 추가
const loginForm = document.getElementById("login-form");
const signupMessage = document.createElement("p");
signupMessage.textContent = "새로운 이름을 입력하면 회원가입 됩니다.";
signupMessage.style.color = "green"; // 메시지 색상 설정
signupMessage.style.fontWeight = "bold"; // 메시지 굵게 설정
loginForm.insertBefore(signupMessage, loginForm.firstChild);

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("name-input").value.trim();
  const password = document.getElementById("password-input").value.trim();

  if (!name || password.length !== 4) {
    alert("유효한 이름과 4자리 비밀번호를 입력해주세요.");
    return;
  }

  try {
    const response = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
    });

    const result = await response.json();

    if (response.ok && result.status === "success") {
      // URL에 이름 추가
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("name", name);
      window.history.replaceState({}, "", currentUrl.toString());

      // 환영 메시지 표시
      const welcomeSection = document.getElementById("welcome-section");
      document.getElementById("welcome-message").textContent = result.message;
      welcomeSection.style.display = "block";

      // 로그인 폼 숨기기
      document.getElementById("login-form").style.display = "none";

      // 개인 취향 카드 만들기 버튼 활성화
      document.getElementById("create-preferences-card").disabled = false;

      // 회원가입 메시지 알림
      if (response.status === 201) {
        alert(result.message);
      }
    } else {
      alert(result.message);
    }
  } catch (error) {
    console.error("로그인 실패:", error);
    alert("서버 오류가 발생했습니다. 다시 시도해주세요.");
  }
});

// 로그아웃 버튼 클릭 이벤트
document.getElementById("logout-button").addEventListener("click", () => {
  // URL에서 name 파라미터 제거
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.delete("name");
  window.history.replaceState({}, "", currentUrl.toString());

  // 초기 상태로 UI 복원
  document.getElementById("welcome-section").style.display = "none";
  document.getElementById("login-form").style.display = "block";
  document.getElementById("name-input").value = "";
  document.getElementById("password-input").value = "";
  document.getElementById("create-preferences-card").disabled = true;

  // 세션 스토리지 초기화
  sessionStorage.clear();

  alert("로그아웃되었습니다.");
});
