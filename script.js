
const STORAGE_KEY = "studentLibraryDB"; 
const LOAN_DAYS = 15;                    
const MAX_BOOKS = 2;                      
const DAY_MS = 24 * 60 * 60 * 1000;      
const ADMIN_USERNAME = "admin";          
const ADMIN_PASSWORD = "admin123";
const LIMIT_MESSAGE = "You can borrow only 2 books at a time. Please return a book first.";

let db = null;            
let currentUser = null;      

function load(){
  const savedText = localStorage.getItem(STORAGE_KEY);
  if (savedText) {
    db = JSON.parse(savedText);
    db.books.forEach(function (book) {
      if (!book.category) book.category = "General";
    });
  } else {
    db = createStartingData();   
    save();
  }
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}
function createStartingData() {
  return {
    nextId: 5,
    students: [],
    books: [
      { id: 1, title: "To Kill a Mockingbird", author: "Harper Lee", category: "Literature", totalCopies: 3 },
      { id: 2, title: "1984", author: "George Orwell", category: "Literature", totalCopies: 2 },
      { id: 3, title: "The Alchemist", author: "Paulo Coelho", category: "Philosophy", totalCopies: 4 },
      { id: 4, title: "A Brief History of Time", author: "Stephen Hawking", category: "Science", totalCopies: 1 }
    ],
    loans: []           // { id, bookId, bookTitle, studentId, borrowDate, status, requestDate, returnDate }
  };
}
function byId(id) {
  return document.getElementById(id);
}
function newId() {
  const id = db.nextId;
  db.nextId = db.nextId + 1;
  return id;
}
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function formatDate(isoText) {
  return new Date(isoText).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric"
  });
}
function getDueDate(borrowDate) {
  return new Date(new Date(borrowDate).getTime() + LOAN_DAYS * DAY_MS).toISOString();
}
function isActive(loan) {
  return loan.status === "borrowed" || loan.status === "return_requested";
}

function countActiveLoans(bookId) {
  return db.loans.filter(function (loan) {
    return loan.bookId === bookId && isActive(loan);
  }).length;
}
function getAvailable(book) {
  return book.totalCopies - countActiveLoans(book.id);
}

function getTotalAvailable() {
  let total = 0;
  db.books.forEach(function (book) { total += getAvailable(book); });
  return total;
}

/**
 * findStudent(studentId)
 * এই আইডির স্টুডেন্ট অবজেক্ট ফেরত দেয়, না পেলে undefined।
 */
function findStudent(studentId) {
  return db.students.find(function (student) {
    return student.studentId === studentId;
  });
}

/**
 * getActiveLoans(studentId)
 * স্টুডেন্ট এখন যে বইগুলো রেখেছে তার তালিকা দেয় (০, ১ বা ২টা লোন)।
 */
function getActiveLoans(studentId) {
  return db.loans.filter(function (loan) {
    return loan.studentId === studentId && isActive(loan);
  });
}


function getCategories() {
  const names = [];
  db.books.forEach(function (book) {
    if (names.indexOf(book.category) === -1) names.push(book.category);
  });
  return names.sort();
}


function getStudentName(studentId) {
  const student = findStudent(studentId);
  return student ? student.name : "Unknown student";
}


function getPendingRequests() {
  return db.loans.filter(function (l) { return l.status === "return_requested"; });
}


function showMessage(elementId, text, type) {
  const box = byId(elementId);
  box.textContent = text;
  box.className = text ? "message " + type : "message";
}

/**
 * showToast(text)
 * স্ক্রিনের নিচে ৩ সেকেন্ডের জন্য ছোট একটা মেসেজ দেখায়।
 */
function showToast(text) {
  const toast = byId("toast");
  toast.textContent = text;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);   // আগের টাইমার থাকলে বাতিল করা, যাতে মেসেজ আগেই লুকিয়ে না যায়
  showToast.timer = setTimeout(function () {
    toast.classList.add("hidden");
  }, 3000);
}

/**
 * statCard(value, label)
 * একটা পরিসংখ্যান কার্ডের HTML বানায়।
 */
function statCard(value, label) {
  return '<div class="stat">' +
           '<div class="stat-value">' + value + '</div>' +
           '<div class="stat-label">' + label + '</div>' +
         '</div>';
}

function emptyRow(columns, text) {
  return '<tr><td class="empty" colspan="' + columns + '">' + text + '</td></tr>';
}

/**
 * showPage(pageId)
 * একটা পেজ (loginPage, studentPage বা adminPage) দেখায়, বাকিগুলো লুকায়।
 */
function showPage(pageId) {
  ["loginPage", "studentPage", "adminPage"].forEach(function (id) {
    byId(id).classList.toggle("hidden", id !== pageId);   // id মিললে hidden সরে যায়, না মিললে বসে
  });
  window.scrollTo(0, 0);   // পেজের একদম ওপরে যাওয়া
}

function showForm(name) {
  byId("studentLoginForm").classList.toggle("hidden", name !== "studentLogin");
  byId("signupForm").classList.toggle("hidden", name !== "signup");
  byId("adminLoginForm").classList.toggle("hidden", name !== "adminLogin");
  // ফর্ম বদলানোর সময় আগের মেসেজ মুছে ফেলা
  showMessage("studentLoginMsg", "");
  showMessage("signupMsg", "");
  showMessage("adminLoginMsg", "");
}

function switchRole(role) {
  byId("studentTab").classList.toggle("active", role === "student");
  byId("adminTab").classList.toggle("active", role === "admin");
  showForm(role === "student" ? "studentLogin" : "adminLogin");
}

function handleStudentLogin(event) {
  event.preventDefault();   // ফর্ম যেন পেজ রিলোড না করে
  const studentId = byId("loginStudentId").value.trim();
  const password = byId("loginStudentPassword").value;

  const student = findStudent(studentId);
  if (!student || student.password !== password) {
    showMessage("studentLoginMsg", "Wrong Student ID or password. Please try again.", "error");
    return;
  }

  currentUser = { role: "student", studentId: student.studentId };   // কে লগইন করল মনে রাখা
  event.target.reset();
  showMessage("studentLoginMsg", "");
  renderStudentPanel();
  showPage("studentPage");
}

function handleSignup(event) {
  event.preventDefault();
  const name = byId("signupName").value.trim();
  const studentId = byId("signupStudentId").value.trim();
  const password = byId("signupPassword").value;
  const confirm = byId("signupConfirm").value;

  // ইনপুটগুলো একটা একটা করে যাচাই করা
  if (!name || !studentId) {
    showMessage("signupMsg", "Please fill in your full name and Student ID.", "error");
    return;
  }
  if (password.length < 4) {
    showMessage("signupMsg", "Password must be at least 4 characters.", "error");
    return;
  }
  if (password !== confirm) {
    showMessage("signupMsg", "The two passwords do not match.", "error");
    return;
  }
  if (findStudent(studentId)) {
    showMessage("signupMsg", "This Student ID is already registered. Please log in instead.", "error");
    return;
  }
  db.students.push({ name: name, studentId: studentId, password: password });
  save();

  event.target.reset();
  showForm("studentLogin");
  byId("loginStudentId").value = studentId; 
  showMessage("studentLoginMsg", "Account created! You can log in now.", "success");
}

function handleAdminLogin(event) {
  event.preventDefault();
  const username = byId("adminUsername").value.trim();
  const password = byId("adminPassword").value;

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    showMessage("adminLoginMsg", "Wrong admin username or password.", "error");
    return;
  }

  currentUser = { role: "admin" };
  event.target.reset();
  showMessage("adminLoginMsg", "");
  renderAdminPanel();
  showPage("adminPage");
}

function logout() {
  currentUser = null;
  switchRole("student");
  showPage("loginPage");
}


/* ---------- ৫. স্টুডেন্ট ড্যাশবোর্ড ---------- */
function renderStudentPanel() {
  const student = findStudent(currentUser.studentId);
  byId("studentWelcome").textContent = "Hi, " + student.name + " (" + student.studentId + ")";

  byId("studentStats").innerHTML =
    statCard(db.books.length, "Total Subjects") +
    statCard(getTotalAvailable(), "Available Copies");

  renderMyLibrary();
  renderStudentBooks();
}

function renderMyLibrary() {
  const loans = getActiveLoans(currentUser.studentId);

  if (loans.length === 0) {
    byId("myLibraryTable").innerHTML = emptyRow(4, "You have not borrowed any books yet.");
    return;
  }

  // প্রতিটা লোনকে map দিয়ে একটা টেবিল সারিতে রূপান্তর করে join দিয়ে জোড়া লাগানো
  byId("myLibraryTable").innerHTML = loans.map(function (loan) {
    const action = loan.status === "borrowed"
      ? '<button class="btn btn-primary btn-small" onclick="requestReturn(' + loan.id + ')">Request Return</button>'
      : '<span class="badge badge-pending">Return Pending</span>';

    return '<tr>' +
      '<td><strong>' + escapeHtml(loan.bookTitle) + '</strong></td>' +
      '<td>' + formatDate(loan.borrowDate) + '</td>' +
      '<td>' + formatDate(getDueDate(loan.borrowDate)) + '</td>' +
      '<td class="actions">' + action + '</td>' +
    '</tr>';
  }).join("");
}


function renderCategoryFilter() {
  const select = byId("categoryFilter");
  const picked = select.value;   // আগে কী বাছা ছিল তা মনে রাখা
  const categories = getCategories();

  select.innerHTML = '<option value="">All categories</option>' +
    categories.map(function (name) {
      return '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>';
    }).join("");

  select.value = categories.indexOf(picked) !== -1 ? picked : "";
}

function renderStudentBooks() {
  const atLimit = getActiveLoans(currentUser.studentId).length >= MAX_BOOKS;
  showMessage("borrowMsg", atLimit ? LIMIT_MESSAGE : "", "error");

  renderCategoryFilter();
  const category = byId("categoryFilter").value;
  // ক্যাটাগরি ফাঁকা হলে সব বই, নাহলে শুধু মিলে যাওয়া বইগুলো রাখা
  const books = db.books.filter(function (book) {
    return category === "" || book.category === category;
  });

  if (books.length === 0) {
    byId("studentBookTable").innerHTML = emptyRow(5, "No books in the library yet.");
    return;
  }

  byId("studentBookTable").innerHTML = books.map(function (book) {
    const available = getAvailable(book);
    const stock = available > 0
      ? '<span class="badge badge-ok">' + available + '</span>'
      : '<span class="badge badge-red">0</span>';
    const disabled = available <= 0 ? "disabled" : "";   // কপি শেষ হলে বাটন বন্ধ

    return '<tr>' +
      '<td><strong>' + escapeHtml(book.title) + '</strong></td>' +
      '<td>' + escapeHtml(book.author) + '</td>' +
      '<td><span class="badge badge-category">' + escapeHtml(book.category) + '</span></td>' +
      '<td>' + stock + '</td>' +
      '<td class="actions"><button class="btn btn-primary btn-small" ' + disabled +
        ' onclick="borrowBook(' + book.id + ')">Borrow</button></td>' +
    '</tr>';
  }).join("");
}

function borrowBook(bookId) {
  const book = db.books.find(function (b) { return b.id === bookId; });
  const myLoans = getActiveLoans(currentUser.studentId);

  if (myLoans.length >= MAX_BOOKS) {
    showMessage("borrowMsg", LIMIT_MESSAGE, "error");
    showToast(LIMIT_MESSAGE);
    return;
  }
  if (!book || getAvailable(book) <= 0) {
    showToast("Sorry, no copies of this book are available.");
    return;
  }
  if (myLoans.some(function (l) { return l.bookId === bookId; })) {
    showToast("You already have this book.");
    return;
  }

  const borrowDate = new Date().toISOString();
  db.loans.push({
    id: newId(),
    bookId: book.id,
    bookTitle: book.title,          // নাম সেভ রাখা হয়, যাতে বইটা পরে মুছে ফেললেও নাম থেকে যায়
    studentId: currentUser.studentId,
    borrowDate: borrowDate,
    status: "borrowed",
    requestDate: null,
    returnDate: null
  });
  save();

  showToast('You borrowed "' + book.title + '". Due date: ' + formatDate(getDueDate(borrowDate)) +
    '. Please return within ' + LOAN_DAYS + ' days.');
  renderStudentPanel();   // পাওয়া যাওয়া কপি নিজে থেকেই ১ কমে যায় (কারণ সেটা হিসাব করা হয়)
}

function requestReturn(loanId) {
  const loan = db.loans.find(function (l) { return l.id === loanId; });
  if (!loan || loan.status !== "borrowed") return;

  loan.status = "return_requested";
  loan.requestDate = new Date().toISOString();
  save();

  showToast("Return requested. Please wait for the admin to approve it.");
  renderStudentPanel();
}

function renderAdminPanel() {
  byId("adminStats").innerHTML =
    statCard(db.books.length, "Total Subjects") +
    statCard(getTotalAvailable(), "Available Copies") +
    statCard(getPendingRequests().length, "Pending Return Requests");

  renderReturnRequests();
  renderBorrowedList();
  renderAdminBooks();
}

function renderReturnRequests() {
  const requests = getPendingRequests();

  if (requests.length === 0) {
    byId("requestTable").innerHTML = emptyRow(3, "No return requests right now.");
    return;
  }

  byId("requestTable").innerHTML = requests.map(function (loan) {
    return '<tr>' +
      '<td><strong>' + escapeHtml(getStudentName(loan.studentId)) + '</strong></td>' +
      '<td>' + escapeHtml(loan.bookTitle) + '</td>' +
      '<td class="actions"><button class="btn btn-primary btn-small" onclick="approveReturn(' + loan.id + ')">Approve Return</button></td>' +
    '</tr>';
  }).join("");
}
function renderBorrowedList() {
  const loans = db.loans.filter(isActive);

  if (loans.length === 0) {
    byId("borrowedTable").innerHTML = emptyRow(4, "No books are borrowed right now.");
    return;
  }

  byId("borrowedTable").innerHTML = loans.map(function (loan) {
    return '<tr>' +
      '<td>' + escapeHtml(loan.studentId) + '</td>' +
      '<td><strong>' + escapeHtml(getStudentName(loan.studentId)) + '</strong></td>' +
      '<td>' + escapeHtml(loan.bookTitle) + '</td>' +
      '<td>' + formatDate(loan.borrowDate) + '</td>' +
    '</tr>';
  }).join("");
}
function approveReturn(loanId) {
  const loan = db.loans.find(function (l) { return l.id === loanId; });
  if (!loan || loan.status !== "return_requested") return;

  loan.status = "returned";
  loan.returnDate = new Date().toISOString();
  save();

  showToast('Return approved: "' + loan.bookTitle + '" is back in stock.');
  renderAdminPanel();
}
function handleAddBook(event) {
  event.preventDefault();
  const title = byId("bookTitle").value.trim();
  const author = byId("bookAuthor").value.trim();
  const category = byId("bookCategory").value.trim();
  const copies = Number(byId("bookCopies").value);

  if (!title || !author || !category) {
    showMessage("addBookMsg", "Please enter a subject, an author and a category.", "error");
    return;
  }
  if (!Number.isInteger(copies) || copies < 1) {
    showMessage("addBookMsg", "Number of copies must be a whole number of at least 1.", "error");
    return;
  }

  db.books.push({ id: newId(), title: title, author: author, category: category, totalCopies: copies });
  save();

  event.target.reset();
  byId("bookCopies").value = 1;   // reset() এর পরে কপির সংখ্যা আবার ১ করে দেওয়া
  showMessage("addBookMsg", '"' + title + '" was added.', "success");
  renderAdminPanel();
}
function renderAdminBooks() {
  // আগে থেকে থাকা ক্যাটাগরিগুলো datalist-এ সাজেশন হিসেবে বসানো
  byId("categoryList").innerHTML = getCategories().map(function (name) {
    return '<option value="' + escapeHtml(name) + '"></option>';
  }).join("");

  if (db.books.length === 0) {
    byId("adminBookTable").innerHTML = emptyRow(6, "No books yet. Add one above.");
    return;
  }

  byId("adminBookTable").innerHTML = db.books.map(function (book) {
    const borrowedNow = countActiveLoans(book.id) > 0;
    const disabled = borrowedNow ? 'disabled title="This book is borrowed right now"' : "";

    return '<tr>' +
      '<td><strong>' + escapeHtml(book.title) + '</strong></td>' +
      '<td>' + escapeHtml(book.author) + '</td>' +
      '<td><span class="badge badge-category">' + escapeHtml(book.category) + '</span></td>' +
      '<td>' + book.totalCopies + '</td>' +
      '<td>' + getAvailable(book) + '</td>' +
      '<td class="actions"><button class="btn btn-danger btn-small" ' + disabled +
        ' onclick="removeBook(' + book.id + ')">Remove</button></td>' +
    '</tr>';
  }).join("");
}
function removeBook(bookId) {
  const book = db.books.find(function (b) { return b.id === bookId; });

  if (countActiveLoans(bookId) > 0) {
    showToast("This book is borrowed right now and cannot be removed.");
    return;
  }
  if (!confirm('Remove "' + book.title + '" from the library?')) {
    return;   // অ্যাডমিন Cancel দিলে কিছুই হবে না
  }

  db.books = db.books.filter(function (b) { return b.id !== bookId; });   // এই বইটা বাদে বাকিগুলো রাখা
  save();

  showToast('"' + book.title + '" was removed.');
  renderAdminPanel();
}
function refreshCurrentPanel() {
  if (!currentUser) return;
  load();
  if (currentUser.role === "student") renderStudentPanel();
  else renderAdminPanel();
}

function init() {
  load();

  // প্রতিটা ফর্ম submit হলে কোন ফাংশন চলবে তা ঠিক করা
  byId("studentLoginForm").addEventListener("submit", handleStudentLogin);
  byId("signupForm").addEventListener("submit", handleSignup);
  byId("adminLoginForm").addEventListener("submit", handleAdminLogin);
  byId("addBookForm").addEventListener("submit", handleAddBook);
  byId("categoryFilter").addEventListener("change", renderStudentBooks);   // ক্যাটাগরি বদলালে বইয়ের তালিকা নতুন করে আঁকা

  // অ্যাডমিন ও স্টুডেন্ট দুই ট্যাবে খোলা থাকলে, অন্য ট্যাব সেভ করামাত্র সংখ্যাগুলো আপডেট হয়
  window.addEventListener("storage", function (event) {
    if (event.key === STORAGE_KEY) refreshCurrentPanel();
  });

  showPage("loginPage");
}

init();

/* ---------- ৮. মোবাইল মেনু (Mobile slide-in menu) ---------- */
/* Below 768px the top-bar links move into a slide-in menu opened by the hamburger button. */

function toggleMenu(button) {
  const menu = byId(button.getAttribute("aria-controls"));
  const willOpen = !menu.classList.contains("open");
  closeMenu();
  if (willOpen) {
    menu.classList.add("open");
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", "Close menu");
    byId("menuBackdrop").classList.add("show");
    document.documentElement.classList.add("menu-open");
  }
}

function closeMenu() {
  document.querySelectorAll(".side-menu.open").forEach(function (menu) { menu.classList.remove("open"); });
  document.querySelectorAll(".menu-toggle").forEach(function (button) {
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Open menu");
  });
  const backdrop = byId("menuBackdrop");
  if (backdrop) backdrop.classList.remove("show");
  document.documentElement.classList.remove("menu-open");
}

// Close the menu after a menu button is tapped, on Escape, or when switching to desktop width
document.addEventListener("click", function (event) {
  if (event.target.closest(".side-menu button")) closeMenu();
});
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") closeMenu();
});
window.addEventListener("resize", function () {
  if (window.innerWidth >= 768) closeMenu();
});


/* ---------- ৯. অফলাইন অ্যাপ (Service worker for the installable PWA) ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/service-worker.js").catch(function (error) {
      console.warn("Service worker registration failed:", error);
    });
  });
}
