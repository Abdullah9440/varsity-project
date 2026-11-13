/* =========================================================
   Student Library Management System - script.js

   How the code is organised:
     1. Settings
     2. Storage: load() and save()  <- the ONLY place that touches localStorage
     3. Helper functions (dates, stock, small tools)
     4. Login, sign-up and logout
     5. Student dashboard
     6. Admin dashboard
     7. Start the app
   ========================================================= */


/* ---------- 1. SETTINGS ---------- */

const STORAGE_KEY = "studentLibraryDB";   // name of the key in localStorage
const LOAN_DAYS = 15;                     // a book must be returned within 15 days
const MAX_BOOKS = 2;                      // a student can hold at most 2 books at the same time
const DAY_MS = 24 * 60 * 60 * 1000;       // one day in milliseconds
const ADMIN_USERNAME = "admin";           // demo admin account
const ADMIN_PASSWORD = "admin123";
const LIMIT_MESSAGE = "You can borrow only 2 books at a time. Please return a book first.";

let db = null;                // the whole database (students, books, loans) lives here while the app runs
let currentUser = null;       // who is logged in: { role: "student", studentId: "..." } or { role: "admin" }


/* ---------- 2. STORAGE (mock database) ---------- */

/**
 * load()
 * Reads the database from localStorage and puts it in the variable "db".
 * The very first time (nothing saved yet) it creates starting data with 4 sample books.
 * To use a real backend later, only this function (and save) need to change.
 */
function load() {
  const savedText = localStorage.getItem(STORAGE_KEY);
  if (savedText) {
    db = JSON.parse(savedText);      // turn the saved text back into an object
    // books saved before categories existed get the category "General"
    db.books.forEach(function (book) {
      if (!book.category) book.category = "General";
    });
  } else {
    db = createStartingData();       // first visit: use sample data
    save();
  }
}

/**
 * save()
 * Writes the whole "db" object into localStorage as text (JSON).
 * Call it after every change so the data survives a page refresh.
 */
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

/**
 * createStartingData()
 * Returns the empty database with 4 sample books.
 * Note: we store only "totalCopies". The available number is always calculated.
 */
function createStartingData() {
  return {
    nextId: 5,          // next id number to give to a new book or loan
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


/* ---------- 3. HELPER FUNCTIONS ---------- */

/**
 * byId(id)
 * Short way to write document.getElementById(id).
 */
function byId(id) {
  return document.getElementById(id);
}

/**
 * newId()
 * Gives a new unique number for a book or a loan, then increases the counter.
 */
function newId() {
  const id = db.nextId;
  db.nextId = db.nextId + 1;
  return id;
}

/**
 * escapeHtml(text)
 * Makes text safe to put inside HTML, so a book title like "<b>" is shown as text
 * and cannot break the page.
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
 * Turns a saved date (for example "2026-11-11T10:00:00.000Z") into "11 Nov 2026".
 */
function formatDate(isoText) {
  return new Date(isoText).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric"
  });
}

/**
 * getDueDate(borrowDate)
 * The due date is the borrow date + 15 days.
 */
function getDueDate(borrowDate) {
  return new Date(new Date(borrowDate).getTime() + LOAN_DAYS * DAY_MS).toISOString();
}

/**
 * isActive(loan)
 * A loan is "active" while the student still has the book:
 * status is "borrowed" or "return_requested" (waiting for admin).
 */
function isActive(loan) {
  return loan.status === "borrowed" || loan.status === "return_requested";
}

/**
 * countActiveLoans(bookId)
 * Counts how many copies of one book are out with students right now.
 */
function countActiveLoans(bookId) {
  return db.loans.filter(function (loan) {
    return loan.bookId === bookId && isActive(loan);
  }).length;
}

/**
 * getAvailable(book)
 * Available copies = total copies - active loans.
 * We never store this number, so admin and student always see the same value.
 */
function getAvailable(book) {
  return book.totalCopies - countActiveLoans(book.id);
}

/**
 * getTotalAvailable()
 * Adds up the available copies of every book.
 */
function getTotalAvailable() {
  let total = 0;
  db.books.forEach(function (book) { total += getAvailable(book); });
  return total;
}

/**
 * findStudent(studentId)
 * Returns the student object with this ID, or undefined if not found.
 */
function findStudent(studentId) {
  return db.students.find(function (student) {
    return student.studentId === studentId;
  });
}

/**
 * getActiveLoans(studentId)
 * Returns the list of books the student is holding now (0, 1 or 2 loans).
 */
function getActiveLoans(studentId) {
  return db.loans.filter(function (loan) {
    return loan.studentId === studentId && isActive(loan);
  });
}

/**
 * getCategories()
 * Returns every category used by the books, without repeats, in A-Z order.
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
 * Returns the student's full name, used in the admin Return Requests list.
 */
function getStudentName(studentId) {
  const student = findStudent(studentId);
  return student ? student.name : "Unknown student";
}

/**
 * getPendingRequests()
 * Returns every loan that is waiting for the admin to approve the return.
 */
function getPendingRequests() {
  return db.loans.filter(function (l) { return l.status === "return_requested"; });
}

/**
 * showMessage(elementId, text, type)
 * Shows an error (red) or success (green) message under a form.
 * Pass an empty text to hide the message.
 */
function showMessage(elementId, text, type) {
  const box = byId(elementId);
  box.textContent = text;
  box.className = text ? "message " + type : "message";
}

/**
 * showToast(text)
 * Shows a small message at the bottom of the screen for 3 seconds.
 */
function showToast(text) {
  const toast = byId("toast");
  toast.textContent = text;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(function () {
    toast.classList.add("hidden");
  }, 3000);
}

/**
 * statCard(value, label)
 * Builds the HTML for one statistics card.
 */
function statCard(value, label) {
  return '<div class="stat">' +
           '<div class="stat-value">' + value + '</div>' +
           '<div class="stat-label">' + label + '</div>' +
         '</div>';
}

/**
 * emptyRow(columns, text)
 * Builds one table row that says the table is empty.
 */
function emptyRow(columns, text) {
  return '<tr><td class="empty" colspan="' + columns + '">' + text + '</td></tr>';
}


/* ---------- 4. LOGIN, SIGN-UP AND LOGOUT ---------- */

/**
 * showPage(pageId)
 * Shows one page (loginPage, studentPage or adminPage) and hides the others.
 */
function showPage(pageId) {
  ["loginPage", "studentPage", "adminPage"].forEach(function (id) {
    byId(id).classList.toggle("hidden", id !== pageId);
  });
  window.scrollTo(0, 0);
}

/**
 * showForm(name)
 * Shows one form on the login card: "studentLogin", "signup" or "adminLogin".
 */
function showForm(name) {
  byId("studentLoginForm").classList.toggle("hidden", name !== "studentLogin");
  byId("signupForm").classList.toggle("hidden", name !== "signup");
  byId("adminLoginForm").classList.toggle("hidden", name !== "adminLogin");
  // clear old messages when switching forms
  showMessage("studentLoginMsg", "");
  showMessage("signupMsg", "");
  showMessage("adminLoginMsg", "");
}

/**
 * switchRole(role)
 * Called by the Student / Admin switch. Highlights the chosen tab and shows its form.
 */
function switchRole(role) {
  byId("studentTab").classList.toggle("active", role === "student");
  byId("adminTab").classList.toggle("active", role === "admin");
  showForm(role === "student" ? "studentLogin" : "adminLogin");
}

/**
 * handleStudentLogin(event)
 * Checks the Student ID and password. If correct, opens the student dashboard.
 */
function handleStudentLogin(event) {
  event.preventDefault();   // stop the form from reloading the page
  const studentId = byId("loginStudentId").value.trim();
  const password = byId("loginStudentPassword").value;

  const student = findStudent(studentId);
  if (!student || student.password !== password) {
    showMessage("studentLoginMsg", "Wrong Student ID or password. Please try again.", "error");
    return;
  }

  currentUser = { role: "student", studentId: student.studentId };
  event.target.reset();
  showMessage("studentLoginMsg", "");
  renderStudentPanel();
  showPage("studentPage");
}

/**
 * handleSignup(event)
 * Creates a new student account after checking the inputs.
 */
function handleSignup(event) {
  event.preventDefault();
  const name = byId("signupName").value.trim();
  const studentId = byId("signupStudentId").value.trim();
  const password = byId("signupPassword").value;
  const confirm = byId("signupConfirm").value;

  // check the inputs one by one
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

  // everything is fine: save the new student
  db.students.push({ name: name, studentId: studentId, password: password });
  save();

  event.target.reset();
  showForm("studentLogin");
  byId("loginStudentId").value = studentId;
  showMessage("studentLoginMsg", "Account created! You can log in now.", "success");
}

/**
 * handleAdminLogin(event)
 * Checks the admin username and password. If correct, opens the admin dashboard.
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
 * Forgets the current user and goes back to the login page.
 */
function logout() {
  currentUser = null;
  switchRole("student");
  showPage("loginPage");
}


/* ---------- 5. STUDENT DASHBOARD ---------- */

/**
 * renderStudentPanel()
 * Draws everything on the student page: welcome text, 2 stat cards,
 * "My Library" and the Book List.
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
 * Lists the books the student is holding, with borrow date, due date and
 * a "Request Return" button (or a "Return Pending" badge after requesting).
 */
function renderMyLibrary() {
  const loans = getActiveLoans(currentUser.studentId);

  if (loans.length === 0) {
    byId("myLibraryTable").innerHTML = emptyRow(4, "You have not borrowed any books yet.");
    return;
  }

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
 * Fills the "Category" drop-down above the student's Book List.
 * Keeps the category the student already picked, if it still exists.
 */
function renderCategoryFilter() {
  const select = byId("categoryFilter");
  const picked = select.value;
  const categories = getCategories();

  select.innerHTML = '<option value="">All categories</option>' +
    categories.map(function (name) {
      return '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>';
    }).join("");

  select.value = categories.indexOf(picked) !== -1 ? picked : "";
}

/**
 * renderStudentBooks()
 * Fills the Book List with subject, author, category, available copies and a Borrow button.
 * Only books of the chosen category are shown ("All categories" shows every book).
 * Borrow is disabled when no copy is available.
 * When the student already has 2 books, the limit message is shown above the list.
 */
function renderStudentBooks() {
  const atLimit = getActiveLoans(currentUser.studentId).length >= MAX_BOOKS;
  showMessage("borrowMsg", atLimit ? LIMIT_MESSAGE : "", "error");

  renderCategoryFilter();
  const category = byId("categoryFilter").value;
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
    const disabled = available <= 0 ? "disabled" : "";

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
 * Creates a new loan for the logged-in student.
 * Rules: at most 2 books at the same time, not the same book twice,
 * and the book must have a free copy.
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
    bookTitle: book.title,          // saved so the name is kept even if the book is removed later
    studentId: currentUser.studentId,
    borrowDate: borrowDate,
    status: "borrowed",
    requestDate: null,
    returnDate: null
  });
  save();

  showToast('You borrowed "' + book.title + '". Due date: ' + formatDate(getDueDate(borrowDate)) +
    '. Please return within ' + LOAN_DAYS + ' days.');
  renderStudentPanel();   // available copies go down by one automatically (they are calculated)
}

/**
 * requestReturn(loanId)
 * Changes the loan status to "return_requested" (shown as "Return Pending").
 * The request now appears in the admin's Return Requests list.
 * The copy count does NOT change yet: it changes only when the admin approves.
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


/* ---------- 6. ADMIN DASHBOARD ---------- */

/**
 * renderAdminPanel()
 * Draws every section of the admin page.
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
 * Shows every return request: student name, book title and an "Approve Return" button.
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
 * Shows every book that is out with a student right now:
 * Student ID, student name, subject and borrow date.
 * A book stays in this list until the admin approves its return.
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
 * Completes the return: status becomes "returned", so the available copies go up by one,
 * the request disappears, and the book leaves the student's "My Library".
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
 * Adds a new book from the Add Book form (subject, author, category, number of copies).
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
  byId("bookCopies").value = 1;
  showMessage("addBookMsg", '"' + title + '" was added.', "success");
  renderAdminPanel();
}

/**
 * renderAdminBooks()
 * Shows all books with category, total copies, available copies and a Remove button.
 * The Remove button is disabled while any copy is borrowed.
 * Also fills the category suggestions of the Add Book form.
 */
function renderAdminBooks() {
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
 * Deletes a book, but only if no copy of it is borrowed right now.
 */
function removeBook(bookId) {
  const book = db.books.find(function (b) { return b.id === bookId; });

  if (countActiveLoans(bookId) > 0) {
    showToast("This book is borrowed right now and cannot be removed.");
    return;
  }
  if (!confirm('Remove "' + book.title + '" from the library?')) {
    return;
  }

  db.books = db.books.filter(function (b) { return b.id !== bookId; });
  save();

  showToast('"' + book.title + '" was removed.');
  renderAdminPanel();
}


/* ---------- 7. START THE APP ---------- */

/**
 * refreshCurrentPanel()
 * Reloads the data and redraws whichever dashboard is open.
 * Runs when another browser tab changes the data, so admin and student stay in sync.
 */
function refreshCurrentPanel() {
  if (!currentUser) return;
  load();
  if (currentUser.role === "student") renderStudentPanel();
  else renderAdminPanel();
}

/**
 * init()
 * Runs once when the page opens: loads the data and connects the forms to their functions.
 */
function init() {
  load();

  byId("studentLoginForm").addEventListener("submit", handleStudentLogin);
  byId("signupForm").addEventListener("submit", handleSignup);
  byId("adminLoginForm").addEventListener("submit", handleAdminLogin);
  byId("addBookForm").addEventListener("submit", handleAddBook);
  byId("categoryFilter").addEventListener("change", renderStudentBooks);

  // if admin and student are open in two tabs, update the numbers when the other tab saves
  window.addEventListener("storage", function (event) {
    if (event.key === STORAGE_KEY) refreshCurrentPanel();
  });

  showPage("loginPage");
}

init();
