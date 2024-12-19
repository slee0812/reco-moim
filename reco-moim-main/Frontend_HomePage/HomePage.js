document
  .getElementById("terms-checkbox")
  .addEventListener("change", function () {
    const preferencesSection = document.getElementById("preferences-section");
    if (this.checked) {
      preferencesSection.style.display = "block";
    } else {
      preferencesSection.style.display = "none";
    }
  });

document
  .getElementById("create-preferences-card")
  .addEventListener("click", function () {
    const preferences = document.getElementById("preferences").value;
    const termsCheckbox = document.getElementById("terms-checkbox");
    if (preferences.trim() === "") {
      alert("개인 취향을 입력해주세요!");
      return;
    }
    if (!termsCheckbox.checked) {
      alert("약관에 동의해주세요!");
      return;
    }
    alert("개인 취향 카드를 생성합니다: " + preferences);
  });
