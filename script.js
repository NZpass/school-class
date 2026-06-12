import { collection, addDoc, deleteDoc, doc, onSnapshot, getDocs, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const db = window.db;
const auth = window.auth;

let currentUser = null;
let currentUserRole = null;

const collections = {
    subjects: collection(db, "subjects"),
    schedule: collection(db, "schedule"),
    students: collection(db, "students"),
    teachers: collection(db, "teachers"),
    parents: collection(db, "parents"),
    messages: collection(db, "messages"),
    grades: collection(db, "grades"),
    homework: collection(db, "homework"),
    users: collection(db, "users")
};

let appData = {
    subjects: [], schedule: [], students: [], teachers: [], 
    parents: [], messages: [], grades: [], homework: []
};

// ===== АВТОРИЗАЦИЯ =====
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        errorEl.textContent = '';
    } catch (error) {
        errorEl.textContent = 'Ошибка входа: ' + error.message;
    }
});

document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // Получаем роль пользователя
        const userDoc = await getDocs(collection(db, "users"));
        const userData = userDoc.docs.find(d => d.id === user.uid);
        currentUserRole = userData?.data()?.role || 'parent';
        
        // Показываем интерфейс
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-interface').style.display = 'block';
        
        // Отображаем информацию о пользователе
        document.getElementById('user-email').textContent = user.email;
        const roleBadge = document.getElementById('user-role-badge');
        roleBadge.textContent = currentUserRole === 'admin' ? 'Админ' : (currentUserRole === 'teacher' ? 'Учитель' : 'Родитель');
        roleBadge.className = `role-badge role-${currentUserRole}`;
        
        // Устанавливаем имя в чате
        document.getElementById('chat-sender-name').value = user.email.split('@')[0];
        document.getElementById('chat-role').value = currentUserRole;
        
        // Показываем/скрываем элементы в зависимости от роли
        updateUIByRole();
        
        // Запускаем слушатели
        initRealtimeListeners();
        
        // Информация о роли на главной
        const roleInfo = document.getElementById('role-info');
        if (currentUserRole === 'admin') {
            roleInfo.innerHTML = '<h3>👑 Вы — Администратор</h3><p>Полный доступ ко всем функциям системы</p>';
        } else if (currentUserRole === 'teacher') {
            roleInfo.innerHTML = '<h3>👨🏫 Вы — Учитель</h3><p>Вы можете добавлять и редактировать данные, ставить оценки, задавать домашние задания</p>';
        } else {
            roleInfo.innerHTML = '<h3>👪 Вы — Родитель</h3><p>Вы можете просматривать расписание, оценки, домашние задания и общаться в чате</p>';
        }
    } else {
        currentUser = null;
        currentUserRole = null;
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-interface').style.display = 'none';
    }
});

function updateUIByRole() {
    const adminElements = document.querySelectorAll('.admin-only');
    const deleteButtons = document.querySelectorAll('.btn-delete');
    const hwActionButtons = document.querySelectorAll('.hw-btn-complete, .hw-btn-delete');
    
    if (currentUserRole === 'parent') {
        // Скрываем формы добавления
        adminElements.forEach(el => el.style.display = 'none');
        // Скрываем кнопки удаления
        deleteButtons.forEach(btn => btn.style.display = 'none');
        // Скрываем кнопки действий в ДЗ
        hwActionButtons.forEach(btn => btn.style.display = 'none');
        // Скрываем колонку "Действия" в таблице родителей
        document.querySelectorAll('th.admin-only').forEach(th => th.style.display = 'none');
    } else {
        // Показываем всё для admin и teacher
        adminElements.forEach(el => el.style.display = 'block');
        deleteButtons.forEach(btn => btn.style.display = 'flex');
        hwActionButtons.forEach(btn => btn.style.display = 'inline-block');
        document.querySelectorAll('th.admin-only').forEach(th => th.style.display = 'table-cell');
    }
}

// ===== СЛУШАТЕЛИ FIREBASE =====
function initRealtimeListeners() {
    console.log("Запуск слушателей Firebase...");
    Object.keys(collections).forEach(key => {
        if (key === 'users') return; // Не слушаем коллекцию users
        onSnapshot(collections[key], (snapshot) => {
            appData[key] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (key === 'schedule') renderSchedule();
            if (key === 'students') renderStudents();
            if (key === 'teachers') renderTeachers();
            if (key === 'parents') renderParents();
            if (key === 'messages') renderChat();
            if (key === 'grades' || key === 'students' || key === 'subjects') renderGradebook();
            if (key === 'homework') renderHomework();
        });
    });
}

// ===== ФУНКЦИИ ОТРИСОВКИ =====
function renderSchedule() {
    const container = document.getElementById('schedule-container');
    if (!container) return;
    const days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница"];
    container.innerHTML = '';
    days.forEach(day => {
        const dayLessons = appData.schedule.filter(l => l.day === day);
        if (dayLessons.length === 0) return;
        const dayCard = document.createElement('div');
        dayCard.className = 'card';
        dayCard.innerHTML = `<h4> ${day}</h4>`;
        dayLessons.sort((a, b) => a.time.localeCompare(b.time)).forEach(lesson => {
            const deleteBtn = currentUserRole !== 'parent' ? 
                `<button class="btn-delete" onclick="window.deleteItem('schedule', '${lesson.id}')">×</button>` : '';
            dayCard.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 0; border-bottom: 1px solid #eee;">
                    <div>
                        <strong>${lesson.time}</strong> — ${lesson.subject}<br>
                        <small style="color:#888;">Кабинет ${lesson.room}</small>
                    </div>
                    ${deleteBtn}
                </div>`;
        });
        container.appendChild(dayCard);
    });
}

function renderStudents() {
    const container = document.getElementById('students-container');
    if (!container) return;
    container.innerHTML = '';
    const statusLabels = { excellent: "Отличник", good: "Хорошист", average: "Троечник" };
    const statusColors = { excellent: "#d4edda", good: "#fff3cd", average: "#f8d7da" };
    const statusTextColors = { excellent: "#155724", good: "#856404", average: "#721c24" };
    appData.students.forEach(st => {
        const card = document.createElement('div');
        card.className = 'card';
        const deleteBtn = currentUserRole !== 'parent' ? 
            `<button class="btn-delete" onclick="window.deleteItem('students', '${st.id}')">×</button>` : '';
        card.innerHTML = `
            ${deleteBtn}
            <h4>${st.name}</h4>
            <p>Средний балл: <strong>${st.grade}</strong></p>
            <span style="background:${statusColors[st.status]}; color:${statusTextColors[st.status]}; padding: 3px 10px; border-radius: 15px; font-size: 0.85rem; font-weight: 600;">
                ${statusLabels[st.status]}
            </span>`;
        container.appendChild(card);
    });
}

function renderTeachers() {
    const container = document.getElementById('teachers-container');
    if (!container) return;
    container.innerHTML = '';
    appData.teachers.forEach(tch => {
        const card = document.createElement('div');
        card.className = 'card';
        const deleteBtn = currentUserRole !== 'parent' ? 
            `<button class="btn-delete" onclick="window.deleteItem('teachers', '${tch.id}')">×</button>` : '';
        card.innerHTML = `
            ${deleteBtn}
            <h4>👨‍🏫 ${tch.name}</h4>
            <p><strong>${tch.subject}</strong></p>
            <p>📞 ${tch.phone}</p>`;
        container.appendChild(card);
    });
}

function renderParents() {
    const tbody = document.getElementById('parents-container');
    if (!tbody) return;
    tbody.innerHTML = '';
    appData.parents.forEach(pr => {
        const row = document.createElement('tr');
        const deleteCell = currentUserRole !== 'parent' ? 
            `<td><button class="btn-delete" style="position:static; width:auto; height:auto; padding: 5px 10px; border-radius: 5px;" onclick="window.deleteItem('parents', '${pr.id}')">Удалить</button></td>` : '';
        row.innerHTML = `
            <td>${pr.name}</td>
            <td>${pr.child}</td>
            <td>${pr.phone}</td>
            ${deleteCell}`;
        tbody.appendChild(row);
    });
}

function renderChat() {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    container.innerHTML = '';
    const sortedMessages = [...appData.messages].sort((a, b) => a.time.localeCompare(b.time));
    sortedMessages.forEach(msg => {
        const div = document.createElement('div');
        div.className = `message ${msg.role}`;
        const roleIcon = msg.role === 'teacher' ? '👨‍🏫' : '👪';
        div.innerHTML = `
            <div class="msg-header">${roleIcon} ${msg.sender}</div>
            <div class="msg-text">${msg.text}</div>
            <div class="msg-time">${msg.time}</div>`;
        container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
}

function renderGradebook() {
    const students = appData.students || [];
    const subjects = (appData.subjects || []).map(s => s.name);
    const defaultSubjects = ["Алгебра", "Русский язык", "Физика", "История", "Английский язык"];
    const finalSubjects = subjects.length > 0 ? subjects : defaultSubjects;
    const allGrades = appData.grades || [];
    const filterEl = document.getElementById('gb-subject-filter');
    const selectedSubject = filterEl ? filterEl.value : 'all';

    const grStudentSelect = document.getElementById('gr-student');
    const grSubjectSelect = document.getElementById('gr-subject');
    
    if (grStudentSelect) {
        grStudentSelect.innerHTML = '<option value="">Выберите ученика...</option>';
        students.forEach(st => {
            const opt = document.createElement('option');
            opt.value = st.id;
            opt.textContent = st.name;
            grStudentSelect.appendChild(opt);
        });
    }

    if (grSubjectSelect && filterEl) {
        grSubjectSelect.innerHTML = '<option value="">Выберите предмет...</option>';
        filterEl.innerHTML = '<option value="all">Все предметы</option>';
        finalSubjects.forEach(subj => {
            const opt1 = document.createElement('option');
            opt1.value = subj; opt1.textContent = subj;
            filterEl.appendChild(opt1);
            const opt2 = document.createElement('option');
            opt2.value = subj; opt2.textContent = subj;
            grSubjectSelect.appendChild(opt2);
        });
    }

    const table = document.getElementById('gradebook-table');
    if (!table) return;

    const filteredGrades = selectedSubject === 'all' 
        ? allGrades 
        : allGrades.filter(g => String(g.subject) === String(selectedSubject));
    const uniqueDates = [...new Set(filteredGrades.map(g => g.date))].sort();

    table.innerHTML = '';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th>Ученик</th>';
    uniqueDates.forEach(date => {
        const d = new Date(date);
        const formattedDate = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        headerRow.innerHTML += `<th>${formattedDate}</th>`;
    });
    headerRow.innerHTML += '<th>Средний балл</th>';
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    students.forEach(student => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${student.name}</td>`;
        let gradeSum = 0, gradeCount = 0;
        uniqueDates.forEach(date => {
            const gradeObj = filteredGrades.find(g => 
                String(g.studentId) === String(student.id) && g.date === date);
            const cell = document.createElement('td');
            cell.className = 'grade-cell';
            if (gradeObj) {
                const deleteBtn = currentUserRole !== 'parent' ? 
                    `<button class="delete-grade-btn" onclick="window.deleteGrade('${gradeObj.id}')">×</button>` : '';
                cell.innerHTML = `<span class="grade-${gradeObj.grade}">${gradeObj.grade}</span>${deleteBtn}`;
                if (gradeObj.grade !== 'н' && !isNaN(parseInt(gradeObj.grade))) {
                    gradeSum += parseInt(gradeObj.grade);
                    gradeCount++;
                }
            } else {
                cell.innerHTML = '<span style="color:#ccc;">-</span>';
            }
            row.appendChild(cell);
        });
        const avgCell = document.createElement('td');
        avgCell.className = 'avg-grade';
        if (gradeCount > 0) {
            const avg = (gradeSum / gradeCount).toFixed(2);
            avgCell.textContent = avg;
            avgCell.style.color = avg >= 4.5 ? '#155724' : (avg >= 3.5 ? '#856404' : '#721c24');
        } else {
            avgCell.textContent = '-';
        }
        row.appendChild(avgCell);
        tbody.appendChild(row);
    });
    table.appendChild(tbody);
}

function renderHomework() {
    const container = document.getElementById('homework-container');
    const emptyMsg = document.getElementById('homework-empty');
    const filterSubject = document.getElementById('hw-filter-subject');
    const filterDate = document.getElementById('hw-filter-date');
    const hwSubjectSelect = document.getElementById('hw-subject');
    
    if (!container) return;
    
    const subjects = (appData.subjects || []).map(s => s.name);
    const defaultSubjects = ["Алгебра", "Русский язык", "Физика", "История", "Английский язык"];
    const finalSubjects = subjects.length > 0 ? subjects : defaultSubjects;
    
    if (hwSubjectSelect) {
        hwSubjectSelect.innerHTML = '<option value="">Выберите предмет...</option>';
        finalSubjects.forEach(subj => {
            const opt = document.createElement('option');
            opt.value = subj;
            opt.textContent = subj;
            hwSubjectSelect.appendChild(opt);
        });
    }
    
    if (filterSubject) {
        const currentFilter = filterSubject.value || 'all';
        filterSubject.innerHTML = '<option value="all">Все предметы</option>';
        finalSubjects.forEach(subj => {
            const opt = document.createElement('option');
            opt.value = subj;
            opt.textContent = subj;
            filterSubject.appendChild(opt);
        });
        filterSubject.value = currentFilter;
    }
    
    let filteredHW = appData.homework || [];
    const selectedSubject = filterSubject ? filterSubject.value : 'all';
    const selectedDate = filterDate ? filterDate.value : '';
    
    if (selectedSubject !== 'all') {
        filteredHW = filteredHW.filter(hw => hw.subject === selectedSubject);
    }
    if (selectedDate) {
        filteredHW = filteredHW.filter(hw => hw.date === selectedDate);
    }
    
    filteredHW.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return new Date(a.deadline) - new Date(b.deadline);
    });
    
    container.innerHTML = '';
    
    if (filteredHW.length === 0) {
        emptyMsg.style.display = 'block';
    } else {
        emptyMsg.style.display = 'none';
        
        filteredHW.forEach(hw => {
            const card = document.createElement('div');
            card.className = 'homework-card';
            
            const today = new Date().toISOString().split('T')[0];
            const deadlineDate = new Date(hw.deadline);
            const isOverdue = !hw.completed && deadlineDate < new Date(today);
            const isToday = hw.deadline === today;
            
            if (hw.completed) card.classList.add('completed');
            else if (isOverdue) card.classList.add('overdue');
            else if (isToday) card.classList.add('today');
            
            const formatDate = (dateStr) => {
                const d = new Date(dateStr);
                return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
            };
            
            const daysUntilDeadline = Math.ceil((deadlineDate - new Date(today)) / (1000 * 60 * 60 * 24));
            let deadlineText = formatDate(hw.deadline);
            let deadlineClass = 'ok';
            
            if (!hw.completed) {
                if (daysUntilDeadline < 0) deadlineText += ' (просрочено!)';
                else if (daysUntilDeadline === 0) deadlineText += ' (сегодня!)';
                else if (daysUntilDeadline === 1) deadlineText += ' (завтра!)';
                else if (daysUntilDeadline <= 3) deadlineText += ` (осталось ${daysUntilDeadline} дн.)`;
                
                if (daysUntilDeadline < 0) deadlineClass = '';
                else if (daysUntilDeadline <= 3) deadlineClass = 'soon';
            }
            
            const actionButtons = currentUserRole !== 'parent' ? `
                <div class="hw-actions">
                    ${!hw.completed ? `<button class="hw-btn hw-btn-complete" onclick="window.toggleHomework('${hw.id}')">✓ Выполнено</button>` : ''}
                    <button class="hw-btn hw-btn-delete" onclick="window.deleteHomework('${hw.id}')">🗑️</button>
                </div>` : '';
            
            card.innerHTML = `
                ${hw.completed ? '<span class="hw-status-badge done">✓ Выполнено</span>' : '<span class="hw-status-badge pending">Ожидает</span>'}
                <div class="hw-header">
                    <div class="hw-subject">${hw.subject}</div>
                </div>
                <div class="hw-date-info">
                    <strong>Выдано:</strong> ${formatDate(hw.date)}
                </div>
                <div class="hw-description">${hw.description}</div>
                <div class="hw-footer">
                    <div class="hw-deadline ${deadlineClass}">
                        📅 Срок: ${deadlineText}
                    </div>
                    ${actionButtons}
                </div>
            `;
            
            container.appendChild(card);
        });
    }
}

// ===== ФУНКЦИИ УДАЛЕНИЯ И ОБНОВЛЕНИЯ =====
window.deleteItem = async function(collectionName, id) {
    if (currentUserRole === 'parent') {
        alert('У вас нет прав для удаления!');
        return;
    }
    if(!confirm('Удалить запись?')) return;
    try { await deleteDoc(doc(db, collectionName, id)); } 
    catch (e) { console.error(e); alert('Ошибка удаления'); }
};

window.deleteGrade = async function(gradeId) {
    if (currentUserRole === 'parent') {
        alert('У вас нет прав для удаления!');
        return;
    }
    if(!confirm('Удалить оценку?')) return;
    try { await deleteDoc(doc(db, "grades", gradeId)); } 
    catch (e) { console.error(e); }
};

window.toggleHomework = async function(id) {
    if (currentUserRole === 'parent') {
        alert('У вас нет прав для изменения статуса!');
        return;
    }
    const hw = appData.homework.find(h => h.id === id);
    if (!hw) return;
    try {
        const hwRef = doc(db, "homework", id);
        await updateDoc(hwRef, { completed: !hw.completed });
    } catch (e) {
        console.error(e);
        alert('Ошибка обновления статуса');
    }
};

window.deleteHomework = async function(id) {
    if (currentUserRole === 'parent') {
        alert('У вас нет прав для удаления!');
        return;
    }
    if(!confirm('Удалить домашнее задание?')) return;
    try { await deleteDoc(doc(db, "homework", id)); } 
    catch (e) { console.error(e); alert('Ошибка удаления'); }
};

async function addItem(collectionName, data) {
    if (currentUserRole === 'parent') {
        alert('У вас нет прав для добавления данных!');
        return;
    }
    try { await addDoc(collections[collectionName], data); } 
    catch (e) { console.error(e); alert('Ошибка сохранения'); }
}

// ===== ОБРАБОТЧИКИ ФОРМ =====
document.getElementById('schedule-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    addItem('schedule', {
        day: document.getElementById('sch-day').value,
        time: document.getElementById('sch-time').value,
        subject: document.getElementById('sch-subject').value,
        room: document.getElementById('sch-room').value
    });
    e.target.reset();
});

document.getElementById('student-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    addItem('students', {
        name: document.getElementById('st-name').value,
        grade: document.getElementById('st-grade').value,
        status: document.getElementById('st-status').value
    });
    e.target.reset();
});

document.getElementById('teacher-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    addItem('teachers', {
        name: document.getElementById('tch-name').value,
        subject: document.getElementById('tch-subject').value,
        phone: document.getElementById('tch-phone').value
    });
    e.target.reset();
});

document.getElementById('parent-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    addItem('parents', {
        name: document.getElementById('pr-name').value,
        child: document.getElementById('pr-child').value,
        phone: document.getElementById('pr-phone').value
    });
    e.target.reset();
});

document.getElementById('grade-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (currentUserRole === 'parent') {
        alert('У вас нет прав для выставления оценок!');
        return;
    }
    const studentId = document.getElementById('gr-student').value;
    const subject = document.getElementById('gr-subject').value;
    const date = document.getElementById('gr-date').value;
    const grade = document.getElementById('gr-value').value;
    if (!studentId || !subject || !date) { alert("Заполните все поля!"); return; }
    const exists = appData.grades.find(g => String(g.studentId) === String(studentId) && g.subject === subject && g.date === date);
    if (exists) {
        if(!confirm(`Оценка за ${date} уже существует. Заменить?`)) return;
        await deleteDoc(doc(db, "grades", exists.id));
    }
    await addItem('grades', { studentId, subject, date, grade });
    e.target.reset();
    document.getElementById('gr-date').valueAsDate = new Date();
    document.getElementById('gb-subject-filter').value = subject;
});

document.getElementById('gb-subject-filter')?.addEventListener('change', renderGradebook);

document.getElementById('homework-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (currentUserRole === 'parent') {
        alert('У вас нет прав для задания домашних работ!');
        return;
    }
    const subject = document.getElementById('hw-subject').value;
    const date = document.getElementById('hw-date').value;
    const deadline = document.getElementById('hw-deadline').value;
    const description = document.getElementById('hw-description').value;
    
    if (!subject || !date || !deadline || !description) {
        alert("Заполните все поля!");
        return;
    }
    
    if (new Date(deadline) < new Date(date)) {
        alert("Срок сдачи не может быть раньше даты выдачи!");
        return;
    }
    
    await addItem('homework', {
        subject,
        date,
        deadline,
        description,
        completed: false,
        createdAt: new Date().toISOString()
    });
    
    e.target.reset();
    document.getElementById('hw-date').valueAsDate = new Date();
    alert('✅ Домашнее задание добавлено!');
});

document.getElementById('hw-filter-subject')?.addEventListener('change', renderHomework);
document.getElementById('hw-filter-date')?.addEventListener('change', renderHomework);

document.getElementById('hw-clear-filter')?.addEventListener('click', () => {
    document.getElementById('hw-filter-subject').value = 'all';
    document.getElementById('hw-filter-date').value = '';
    renderHomework();
});

document.getElementById('chat-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const role = document.getElementById('chat-role').value;
    const senderName = document.getElementById('chat-sender-name').value || currentUser.email;
    const text = document.getElementById('chat-input').value;
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    try {
        addDoc(collections.messages, { sender: senderName, role, text, time });
        document.getElementById('chat-input').value = '';
    } catch (e) {
        console.error(e);
        alert('Ошибка отправки сообщения');
    }
});

// ===== НАВИГАЦИЯ =====
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);
        document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active-section'));
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.classList.add('active-section');
            setTimeout(() => {
                const headerOffset = 70;
                const elementPosition = targetSection.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }, 100);
        }
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        const nav = document.querySelector('.nav');
        if (nav) nav.classList.remove('active');
        const mobileBtn = document.querySelector('.mobile-menu-btn');
        if (mobileBtn) mobileBtn.textContent = '☰';
    });
});

document.querySelector('.mobile-menu-btn')?.addEventListener('click', () => {
    const nav = document.querySelector('.nav');
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    if (nav) nav.classList.toggle('active');
    if (mobileBtn) {
        mobileBtn.textContent = (nav && nav.classList.contains('active')) ? '✕' : '☰';
    }
});

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', async () => {
    const dateInput = document.getElementById('gr-date');
    if (dateInput) dateInput.valueAsDate = new Date();
    
    const hwDateInput = document.getElementById('hw-date');
    if (hwDateInput) hwDateInput.valueAsDate = new Date();
    
    // Создаём тестовых пользователей при первом запуске
    setTimeout(async () => {
        const usersSnapshot = await getDocs(collections.users);
        if (usersSnapshot.empty) {
            const testUsers = [
                { email: 'admin@school.ru', password: 'admin123', role: 'admin', name: 'Администратор' },
                { email: 'teacher@school.ru', password: 'teacher123', role: 'teacher', name: 'Иванова М.П.' },
                { email: 'parent@school.ru', password: 'parent123', role: 'parent', name: 'Александрова Е.В.' }
            ];
            
            for (const user of testUsers) {
                try {
                    const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
                    await setDoc(doc(db, "users", userCredential.user.uid), {
                        email: user.email,
                        role: user.role,
                        name: user.name,
                        createdAt: new Date().toISOString()
                    });
                    console.log(`Создан пользователь: ${user.email} (${user.role})`);
                } catch (e) {
                    console.error(`Ошибка создания ${user.email}:`, e);
                }
            }
        }
    }, 3000);
});

// Дополнительный импорт для создания пользователей
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";