const preferencesForm = document.getElementById("preferences-form");

preferencesForm.addEventListener("submit", async function (event) {
  event.preventDefault(); // 기본 제출 방지

  const name = document.getElementById("name").value.trim();
  const location = document.getElementById("location").value.trim();
  const positivePrompt = document.getElementById("positive-prompt").value.trim();
  const negativePrompt = document.getElementById("negative-prompt").value.trim();

  try {
    const response = await fetch("/save-preference", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name,
        location: location,
        positivePrompt: positivePrompt,
        negativePrompt: negativePrompt,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      alert(result.message);
      window.location.href = "/"; // 성공 후 메인 페이지로 이동
    } else {
      alert("오류: " + result.message);
    }
  } catch (error) {
    console.error("Error:", error);
    alert("서버 오류가 발생했습니다. 다시 시도해주세요.");
  }
});

preferencesForm.addEventListener("reset", function () {
  alert("모든 입력이 초기화되었습니다.");
});
