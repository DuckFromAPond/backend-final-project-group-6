const btn = document.getElementById("dropdownBtnLogs");
const list = document.getElementById("dropdownListLogs");
const input = document.getElementById("userIdInputLogs");

const selected = window.selectedUserName;

if (btn && selected) {
  btn.innerText = selected;
}

if (btn) {
  btn.addEventListener("click", () => {
    list.classList.toggle("hidden");
  });
}

function selectUser(id, label) {
  input.value = id;
  btn.innerText = label;
  list.classList.add("hidden");

  // optional auto submit
  input.closest("form").submit();
}

// close when clicking outside
document.addEventListener("click", (e) => {
  if (!btn.contains(e.target) && !list.contains(e.target)) {
    list.classList.add("hidden");
  }
});