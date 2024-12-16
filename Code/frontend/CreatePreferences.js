// 폼 요소 가져오기
const preferencesForm = document.getElementById("preferences-form");

// 초기화 버튼 이벤트 추가
preferencesForm.addEventListener("reset", function () {
  // 폼 초기화 후 추가 동작 수행
  alert("모든 입력이 초기화되었습니다.");
});
