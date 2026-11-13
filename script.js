/* =========================================================
   স্টুডেন্ট লাইব্রেরি ম্যানেজমেন্ট সিস্টেম - script.js

   কোডটা যেভাবে সাজানো:
     ১. সেটিংস
     ২. স্টোরেজ: load() ও save()  <- শুধু এই জায়গাই localStorage ধরে
     ৩. হেল্পার ফাংশন (তারিখ, স্টক, ছোট ছোট টুল)
     ৪. লগইন, সাইন-আপ ও লগআউট
     ৫. স্টুডেন্ট ড্যাশবোর্ড
     ৬. অ্যাডমিন ড্যাশবোর্ড
     ৭. অ্যাপ চালু করা
   ========================================================= */


/* ---------- ১. সেটিংস ---------- */

const STORAGE_KEY = "studentLibraryDB";   // localStorage-এ ডেটা রাখার চাবির নাম
const LOAN_DAYS = 15;                     // বই ১৫ দিনের মধ্যে ফেরত দিতে হবে
const MAX_BOOKS = 2;                      // একজন স্টুডেন্ট একসাথে সর্বোচ্চ ২টা বই রাখতে পারবে
const DAY_MS = 24 * 60 * 60 * 1000;       // এক দিনে কত মিলিসেকেন্ড
const ADMIN_USERNAME = "admin";           // ডেমো অ্যাডমিন অ্যাকাউন্ট
const ADMIN_PASSWORD = "admin123";
const LIMIT_MESSAGE = "You can borrow only 2 books at a time. Please return a book first.";

let db = null;                // পুরো ডেটাবেস (স্টুডেন্ট, বই, লোন) অ্যাপ চলার সময় এই ভেরিয়েবলে থাকে
let currentUser = null;       // কে লগইন করে আছে: { role: "student", studentId: "..." } অথবা { role: "admin" }


/* ---------- ২. স্টোরেজ (নকল ডেটাবেস) ---------- */

/**
 * load()
 * localStorage থেকে ডেটাবেস পড়ে "db" ভেরিয়েবলে রাখে।
 * একদম প্রথমবার (কিছু সেভ করা নেই) হলে ৪টা নমুনা বইসহ শুরুর ডেটা বানায়।
 * পরে আসল ব্যাকএন্ড লাগালে শুধু এই ফাংশন (আর save) বদলাতে হবে।
 */
function load() {
  const savedText = localStorage.getItem(STORAGE_KEY);
  if (savedText) {
    db = JSON.parse(savedText);      // সেভ করা লেখাকে আবার অবজেক্টে রূপান্তর করা
    // ক্যাটাগরি যোগ হওয়ার আগে সেভ করা বইগুলোর ক্যাটাগরি হবে "General"
    db.books.forEach(function (book) {
      if (!book.category) book.category = "General";
    });
  } else {
    db = createStartingData();       // প্রথমবার: নমুনা ডেটা ব্যবহার করা
    save();
  }
}

/**
 * save()
 * পুরো "db" অবজেক্টকে লেখা (JSON) বানিয়ে localStorage-এ রাখে।
 * প্রতিটা পরিবর্তনের পরে এটা কল করতে হয়, যাতে পেজ রিফ্রেশ করলেও ডেটা থাকে।
 */
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

/**
 * createStartingData()
 * ৪টা নমুনা বইসহ ফাঁকা ডেটাবেস ফেরত দেয়।
 * লক্ষ্য করুন: আমরা শুধু "totalCopies" সেভ করি। available সংখ্যা সবসময় হিসাব করে বের করা হয়।
 */
function createStartingData() {
  return {
    nextId: 5,          // নতুন বই বা লোনকে দেওয়ার পরের আইডি নম্বর
    students: [],       // { name, studentId, password }
    books: [            // { id, title, author, category, totalCopies }
      { id: 1, title: "To Kill a Mockingbird", author: "Harper Lee", category: "Literature", totalCopies: 3 },
      { id: 2, title: "1984", author: "George Orwell", category: "Literature", totalCopies: 2 },
      { id: 3, title: "The Alchemist", author: "Paulo Coelho", category: "Philosophy", totalCopies: 4 },
      { id: 4, title: "A Brief History of Time", author: "Stephen Hawking", category: "Science", totalCopies: 1 }
    ],
    loans: []           // { id, bookId, bookTitle, studentId, borrowDate, status, requestDate, returnDate }
  };
}


/* ---------- ৩. হেল্পার ফাংশন ---------- */

/**
 * byId(id)
 * document.getElementById(id) লেখার ছোট রাস্তা।
 */
function byId(id) {
  return document.getElementById(id);
}

/**
 * newId()
 * বই বা লোনের জন্য নতুন ইউনিক নম্বর দেয়, তারপর কাউন্টার এক বাড়ায়।
 */
function newId() {
  const id = db.nextId;
  db.nextId = db.nextId + 1;
  return id;
}

/**
 * escapeHtml(text)
 * লেখাকে HTML-এর ভেতরে বসানোর জন্য নিরাপদ করে। এতে বইয়ের নাম "<b>" হলেও
 * সেটা সাধারণ লেখা হিসেবে দেখায়, পেজ ভেঙে দিতে পারে না।
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * formatDate(isoText)
 * সেভ করা তারিখ (যেমন "2026-11-11T10:00:00.000Z") কে "11 Nov 2026" আকারে দেখায়।
 */
function formatDate(isoText) {
  return new Date(isoText).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric"
  });
}

/**
 * getDueDate(borrowDate)
 * ফেরতের তারিখ = বই নেওয়ার তারিখ + ১৫ দিন।
 */
function getDueDate(borrowDate) {
  return new Date(new Date(borrowDate).getTime() + LOAN_DAYS * DAY_MS).toISOString();
}

/**
 * isActive(loan)
 * স্টুডেন্টের কাছে বই থাকা পর্যন্ত লোনটা "active":
 * মানে status হয় "borrowed" অথবা "return_requested" (অ্যাডমিনের অপেক্ষায়)।
 */
function isActive(loan) {
  return loan.status === "borrowed" || loan.status === "return_requested";
}

/**
 * countActiveLoans(bookId)
 * একটা বইয়ের কয়টা কপি এখন স্টুডেন্টদের কাছে আছে তা গোনে।
 */
function countActiveLoans(bookId) {
  return db.loans.filter(function (loan) {
    return loan.bookId === bookId && isActive(loan);
  }).length;
}

/**
 * getAvailable(book)
 * পাওয়া যাওয়া কপি = মোট কপি - এখন ধার দেওয়া কপি।
 * এই সংখ্যা আমরা কখনো সেভ করি না, তাই অ্যাডমিন আর স্টুডেন্ট সবসময় একই মান দেখে।
 */
function getAvailable(book) {
  return book.totalCopies - countActiveLoans(book.id);
}

/**
 * getTotalAvailable()
 * সব বইয়ের পাওয়া যাওয়া কপি যোগ করে মোট সংখ্যা দেয়।
 */
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

/**
 * getCategories()
 * বইগুলোতে ব্যবহার হওয়া সব ক্যাটাগরি দেয়, কোনো পুনরাবৃত্তি ছাড়া, A-Z ক্রমে।
 */
function getCategories() {
  const names = [];
  db.books.forEach(function (book) {
    if (names.indexOf(book.category) === -1) names.push(book.category);
  });
  return names.sort();
}

/**
 * getStudentName(studentId)
 * স্টুডেন্টের পুরো নাম ফেরত দেয়, অ্যাডমিনের Return Requests তালিকায় লাগে।
 */
function getStudentName(studentId) {
  const student = findStudent(studentId);
  return student ? student.name : "Unknown student";
}

/**
 * getPendingRequests()
 * অ্যাডমিনের অনুমোদনের অপেক্ষায় থাকা সব ফেরতের অনুরোধ দেয়।
 */
function getPendingRequests() {
  return db.loans.filter(function (l) { return l.status === "return_requested"; });
}

/**
 * showMessage(elementId, text, type)
 * ফর্মের নিচে error (লাল) বা success (সবুজ) মেসেজ দেখায়।
 * ফাঁকা text দিলে মেসেজটা লুকিয়ে যায়।
 */
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

/**
 * emptyRow(columns, text)
 * টেবিল ফাঁকা বোঝানোর জন্য একটা সারি বানায়।
 */
function emptyRow(columns, text) {
  return '<tr><td class="empty" colspan="' + columns + '">' + text + '</td></tr>';
}


/* ---------- ৪. লগইন, সাইন-আপ ও লগআউট ---------- */

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

/**
 * showForm(name)
 * লগইন কার্ডে একটা ফর্ম দেখায়: "studentLogin", "signup" বা "adminLogin"।
 */
function showForm(name) {
  byId("studentLoginForm").classList.toggle("hidden", name !== "studentLogin");
  byId("signupForm").classList.toggle("hidden", name !== "signup");
  byId("adminLoginForm").classList.toggle("hidden", name !== "adminLogin");
  // ফর্ম বদলানোর সময় আগের মেসেজ মুছে ফেলা
  showMessage("studentLoginMsg", "");
  showMessage("signupMsg", "");
  showMessage("adminLoginMsg", "");
}

/**
 * switchRole(role)
 * Student / Admin সুইচ থেকে কল হয়। বেছে নেওয়া ট্যাব হাইলাইট করে এবং তার ফর্ম দেখায়।
 */
function switchRole(role) {
  byId("studentTab").classList.toggle("active", role === "student");
  byId("adminTab").classList.toggle("active", role === "admin");
  showForm(role === "student" ? "studentLogin" : "adminLogin");
}

/**
 * handleStudentLogin(event)
 * স্টুডেন্ট আইডি ও পাসওয়ার্ড মেলায়। ঠিক হলে স্টুডেন্ট ড্যাশবোর্ড খুলে দেয়।
 */
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

/**
 * handleSignup(event)
 * ইনপুট যাচাই করে নতুন স্টুডেন্ট অ্যাকাউন্ট বানায়।
 */
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

  // সব ঠিক আছে: নতুন স্টুডেন্টকে সেভ করা
  db.students.push({ name: name, studentId: studentId, password: password });
  save();

  event.target.reset();
  showForm("studentLogin");
  byId("loginStudentId").value = studentId;   // লগইন ফর্মে আইডিটা আগে থেকেই বসিয়ে দেওয়া
  showMessage("studentLoginMsg", "Account created! You can log in now.", "success");
}

/**
 * handleAdminLogin(event)
 * অ্যাডমিনের ইউজারনেম ও পাসওয়ার্ড মেলায়। ঠিক হলে অ্যাডমিন ড্যাশবোর্ড খুলে দেয়।
 */
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

/**
 * logout()
 * বর্তমান ইউজারকে ভুলে যায় এবং লগইন পেজে ফিরিয়ে নেয়।
 */
function logout() {
  currentUser = null;
  switchRole("student");
  showPage("loginPage");
}


/* ---------- ৫. স্টুডেন্ট ড্যাশবোর্ড ---------- */

/**
 * renderStudentPanel()
 * স্টুডেন্ট পেজের সবকিছু আঁকে: স্বাগতম লেখা, ২টা স্ট্যাট কার্ড,
 * "My Library" এবং Book List।
 */
function renderStudentPanel() {
  const student = findStudent(currentUser.studentId);
  byId("studentWelcome").textContent = "Hi, " + student.name + " (" + student.studentId + ")";

  byId("studentStats").innerHTML =
    statCard(db.books.length, "Total Subjects") +
    statCard(getTotalAvailable(), "Available Copies");

  renderMyLibrary();
  renderStudentBooks();
}

/**
 * renderMyLibrary()
 * স্টুডেন্ট যে বইগুলো রেখেছে সেগুলোর তালিকা দেখায়: নেওয়ার তারিখ, ফেরতের তারিখ
 * এবং একটা "Request Return" বাটন (অনুরোধ পাঠানোর পরে "Return Pending" ব্যাজ)।
 */
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

/**
 * renderCategoryFilter()
 * স্টুডেন্টের Book List-এর ওপরের "Category" ড্রপডাউন ভরে।
 * স্টুডেন্ট আগে যে ক্যাটাগরি বেছেছিল সেটা এখনো থাকলে সেটাই ধরে রাখে।
 */
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

/**
 * renderStudentBooks()
 * Book List ভরে: বিষয়, লেখক, ক্যাটাগরি, পাওয়া যাওয়া কপি এবং Borrow বাটন।
 * শুধু বেছে নেওয়া ক্যাটাগরির বই দেখায় ("All categories" হলে সব বই)।
 * কোনো কপি না থাকলে Borrow বাটন বন্ধ থাকে।
 * স্টুডেন্টের কাছে ২টা বই থাকলে তালিকার ওপরে সীমার মেসেজ দেখায়।
 */
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

/**
 * borrowBook(bookId)
 * লগইন করা স্টুডেন্টের জন্য নতুন একটা লোন বানায়।
 * নিয়ম: একসাথে সর্বোচ্চ ২টা বই, একই বই দুইবার নয়,
 * আর বইটার অন্তত একটা কপি ফাঁকা থাকতে হবে।
 */
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

/**
 * requestReturn(loanId)
 * লোনের status বদলে "return_requested" করে (দেখায় "Return Pending")।
 * এখন অনুরোধটা অ্যাডমিনের Return Requests তালিকায় আসবে।
 * কপির সংখ্যা এখনো বদলায় না: অ্যাডমিন অনুমোদন দিলে তবেই বদলায়।
 */
function requestReturn(loanId) {
  const loan = db.loans.find(function (l) { return l.id === loanId; });
  if (!loan || loan.status !== "borrowed") return;

  loan.status = "return_requested";
  loan.requestDate = new Date().toISOString();
  save();

  showToast("Return requested. Please wait for the admin to approve it.");
  renderStudentPanel();
}


/* ---------- ৬. অ্যাডমিন ড্যাশবোর্ড ---------- */

/**
 * renderAdminPanel()
 * অ্যাডমিন পেজের প্রতিটা অংশ আঁকে।
 */
function renderAdminPanel() {
  byId("adminStats").innerHTML =
    statCard(db.books.length, "Total Subjects") +
    statCard(getTotalAvailable(), "Available Copies") +
    statCard(getPendingRequests().length, "Pending Return Requests");

  renderReturnRequests();
  renderBorrowedList();
  renderAdminBooks();
}

/**
 * renderReturnRequests()
 * প্রতিটা ফেরতের অনুরোধ দেখায়: স্টুডেন্টের নাম, বইয়ের নাম এবং "Approve Return" বাটন।
 */
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

/**
 * renderBorrowedList()
 * এখন স্টুডেন্টদের কাছে থাকা প্রতিটা বই দেখায়:
 * স্টুডেন্ট আইডি, স্টুডেন্টের নাম, বিষয় এবং নেওয়ার তারিখ।
 * অ্যাডমিন ফেরত অনুমোদন না করা পর্যন্ত বই এই তালিকায় থাকে।
 */
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

/**
 * approveReturn(loanId)
 * ফেরত সম্পূর্ণ করে: status হয় "returned", ফলে পাওয়া যাওয়া কপি ১ বাড়ে,
 * অনুরোধটা তালিকা থেকে চলে যায়, আর বইটা স্টুডেন্টের "My Library" থেকে সরে যায়।
 */
function approveReturn(loanId) {
  const loan = db.loans.find(function (l) { return l.id === loanId; });
  if (!loan || loan.status !== "return_requested") return;

  loan.status = "returned";
  loan.returnDate = new Date().toISOString();
  save();

  showToast('Return approved: "' + loan.bookTitle + '" is back in stock.');
  renderAdminPanel();
}

/**
 * handleAddBook(event)
 * Add Book ফর্ম থেকে নতুন বই যোগ করে (বিষয়, লেখক, ক্যাটাগরি, কপির সংখ্যা)।
 */
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

/**
 * renderAdminBooks()
 * সব বই দেখায়: ক্যাটাগরি, মোট কপি, পাওয়া যাওয়া কপি এবং Remove বাটন।
 * কোনো কপি ধার দেওয়া থাকলে Remove বাটন বন্ধ থাকে।
 * Add Book ফর্মের ক্যাটাগরি সাজেশনের তালিকাও এখানে ভরা হয়।
 */
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

/**
 * removeBook(bookId)
 * একটা বই মুছে ফেলে, কিন্তু শুধু তখনই যখন তার কোনো কপি এখন ধার দেওয়া নেই।
 */
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


/* ---------- ৭. অ্যাপ চালু করা ---------- */

/**
 * refreshCurrentPanel()
 * ডেটা আবার লোড করে এবং যে ড্যাশবোর্ড খোলা আছে সেটা নতুন করে আঁকে।
 * অন্য ব্রাউজার ট্যাব ডেটা বদলালে এটা চলে, যাতে অ্যাডমিন ও স্টুডেন্ট একই তথ্য দেখে।
 */
function refreshCurrentPanel() {
  if (!currentUser) return;
  load();
  if (currentUser.role === "student") renderStudentPanel();
  else renderAdminPanel();
}

/**
 * init()
 * পেজ খোলার সময় একবার চলে: ডেটা লোড করে এবং ফর্মগুলোকে তাদের ফাংশনের সাথে জোড়ে।
 */
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