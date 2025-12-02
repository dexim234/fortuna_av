// Призы и их вероятности (в процентах)
const prizes = [
    { name: '10% скидка', displayName: 'Мягкая Удача', probability: 90, angle: 0 },
    { name: '20% скидка', displayName: 'Удачный Поворот', probability: 5, angle: 0 },
    { name: '30% скидка', displayName: 'Золотая Тридцатка', probability: 3, angle: 0 },
    { name: '40% скидка', displayName: 'Почти Джекпот', probability: 0.5, angle: 0 },
    { name: '50% скидка', displayName: 'Полцарства', probability: 0.1, angle: 0 },
    { name: '90% скидка', displayName: '90% скидка', probability: 0, angle: 0 },
    { name: 'Реванш', displayName: 'Реванш', probability: 50, angle: 0 },
    { name: 'Продлённый путь', displayName: '+30 дней к пути', probability: 9, angle: 0 }
];

// Сообщения для призов
const prizeMessages = {
    '10% скидка': 'Тебе выпала Мягкая Удача – поздравляем с 10% скидкой!',
    '20% скидка': 'Тебе выпал Удачный Поворот – поздравляем с 20% скидкой!',
    '30% скидка': 'Тебе выпала Золотая Тридцатка – поздравляем с 30% скидкой!',
    '40% скидка': 'Тебе выпал Почти Джекпот – поздравляем с 40% скидкой!',
    '50% скидка': 'Тебе выпало Полцарства – поздравляем с 50% скидкой!',
    '90% скидка': 'Поздравляем с 90% скидкой!',
    'Реванш': 'Тебе выпала возможность взять реванш – попытка не сгорела, действуй скорее, пока удача улыбается тебе!',
    'Продлённый путь': 'Поздравляем, ты получаешь + 30 дней к продукту!'
};

// Canvas и контекст
let canvas;
let ctx;
let centerX;
let centerY;
const radius = 240;

// Состояние
let isSpinning = false;
let currentRotation = 0;
let spinsCount = 0;

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    canvas = document.getElementById('wheelCanvas');
    if (!canvas) {
        console.error('Canvas not found!');
        return;
    }
    ctx = canvas.getContext('2d');
    centerX = canvas.width / 2;
    centerY = canvas.height / 2;
    
    // Инициализация Telegram WebApp (если доступно)
    if (window.Telegram && window.Telegram.WebApp) {
        const webApp = window.Telegram.WebApp;
        webApp.ready();
        webApp.expand();
        
        // Сохраняем user_id в localStorage для последующего использования
        if (webApp.initDataUnsafe && webApp.initDataUnsafe.user) {
            localStorage.setItem('telegram_user_id', webApp.initDataUnsafe.user.id.toString());
            console.log('Telegram user_id сохранен:', webApp.initDataUnsafe.user.id);
        }
        
            // Проверяем, нужно ли показать запрос разрешения
        setTimeout(() => {
            checkAndRequestPermission();
        }, 500);
    }
    
    init();
    
    // Делаем resetAttempts доступной сразу после загрузки
    console.log('Для сброса попыток используйте: resetAttempts()');
});

function init() {
    if (!canvas || !ctx) {
        console.error('Canvas not initialized!');
        return;
    }
    calculateAngles();
    restoreLastPrize(); // Восстанавливаем последний выигранный приз
    drawWheel();
    updateUI();
    setupEventListeners();
    setupFAQ();
    setupModal();
}

// Расчет углов для секторов
function calculateAngles() {
    // Все секторы визуально одинакового размера (равномерное распределение)
    const anglePerSector = (2 * Math.PI) / prizes.length;
    
    let currentAngle = -Math.PI / 2; // Начинаем сверху
    prizes.forEach(prize => {
        prize.angle = anglePerSector;
        prize.startAngle = currentAngle;
        prize.endAngle = currentAngle + anglePerSector;
        currentAngle += anglePerSector;
    });
}

// Восстановление последнего выигранного приза при загрузке страницы
function restoreLastPrize() {
    const state = getState();
    
    // Проверяем, есть ли сохраненный приз и был ли спин
    if (!state.lastPrize || !state.hasSpun) {
        return; // Нет сохраненного приза или не было спинов
    }
    
    // Проверяем, что прошло меньше 30 дней с последнего спина
    if (state.lastSpinDate) {
        const daysSinceSpin = (Date.now() - state.lastSpinDate) / (1000 * 60 * 60 * 24);
        if (daysSinceSpin >= 30) {
            return; // Прошло больше 30 дней, не восстанавливаем
        }
    }
    
    // Находим приз по имени
    const lastPrize = prizes.find(p => p.name === state.lastPrize);
    if (!lastPrize) {
        return; // Приз не найден
    }
    
    // Восстанавливаем позицию колеса (если она сохранена, иначе используем 0)
    if (state.wheelRotation !== undefined && state.wheelRotation !== null) {
        currentRotation = state.wheelRotation;
    } else {
        // Если позиция не сохранена, вычисляем её на основе приза
        const prizeCenterAngle = lastPrize.startAngle + (lastPrize.endAngle - lastPrize.startAngle) / 2;
        // Стрелка находится сверху (угол 3π/2 или -π/2)
        // Нужно повернуть колесо так, чтобы центр приза оказался под стрелкой
        const targetAngle = 3 * Math.PI / 2;
        let rotationNeeded = targetAngle - prizeCenterAngle;
        if (rotationNeeded < 0) {
            rotationNeeded += 2 * Math.PI;
        }
        currentRotation = rotationNeeded;
    }
    
    // Показываем последний приз в уведомлении с ключом
    const protectionKey = state.lastProtectionKey || 'N/A';
    showResult(lastPrize, protectionKey);
    
    // Разблокируем кнопки скачивания
    if (state.hasSpun) {
        unlockDownloadButtons();
    }
}

// Рисование колеса
function drawWheel() {
    if (!ctx || !canvas) return;
    
    // Очищаем canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Рисуем фон колеса (белый круг для контраста)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 5, 0, 2 * Math.PI);
    ctx.fill();
    
    let colorIndex = 0;
    const colors = ['#0A0A0A', '#4E6E49'];
    
    prizes.forEach((prize, index) => {
        const startAngle = prize.startAngle + currentRotation;
        const endAngle = prize.endAngle + currentRotation;
        
        // Цвет сектора
        ctx.fillStyle = colors[colorIndex % 2];
        colorIndex++;
        
        // Рисуем сектор
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fill();
        
        // Белая линия между секторами
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
            centerX + Math.cos(startAngle) * radius,
            centerY + Math.sin(startAngle) * radius
        );
        ctx.stroke();
        
        // Текст на секторе (только если сектор достаточно большой)
        const sectorAngle = endAngle - startAngle;
        if (sectorAngle > 0.1) { // Минимальный угол для отображения текста
            ctx.save();
            ctx.translate(centerX, centerY);
            const textAngle = startAngle + sectorAngle / 2;
            ctx.rotate(textAngle);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#FFFFFF';
            
            // Размер шрифта зависит от размера сектора
            const fontSize = Math.max(12, Math.min(18, sectorAngle * 30));
            ctx.font = `bold ${fontSize}px Arial`;
            
            const text = prize.displayName;
            const textRadius = radius * 0.5; // Позиция текста от центра
            
            // Разбиваем длинный текст на строки
            const words = text.split(' ');
            const lines = [];
            let currentLine = '';
            
            words.forEach(word => {
                const testLine = currentLine ? currentLine + ' ' + word : word;
                const metrics = ctx.measureText(testLine);
                const maxWidth = radius * 0.6;
                
                if (metrics.width > maxWidth && currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            });
            if (currentLine) lines.push(currentLine);
            
            // Рисуем строки текста
            const lineHeight = fontSize + 4;
            const startY = -(lines.length - 1) * lineHeight / 2;
            lines.forEach((line, index) => {
                ctx.fillText(line, textRadius, startY + index * lineHeight);
            });
            
            ctx.restore();
        }
    });
    
    // Обводка колеса
    ctx.strokeStyle = '#4E6E49';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Центральный круг
    ctx.fillStyle = '#0A0A0A';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 40, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#4E6E49';
    ctx.lineWidth = 3;
    ctx.stroke();
}

// Выбор приза по вероятности
function selectPrize() {
    const state = getState();
    const attemptsLeft = state.attemptsLeft;
    const revanchCount = state.revanchCount || 0;
    const totalAttempts = 3;
    const usedAttempts = totalAttempts - attemptsLeft;
    
    // Если реванш еще не выпадал и осталась последняя попытка, гарантируем реванш
    // (чтобы он выпал хотя бы один раз во время активных попыток)
    if (attemptsLeft === 1 && revanchCount === 0 && usedAttempts >= 1) {
        console.log('Гарантированный реванш на последней попытке');
        return prizes.find(p => p.name === 'Реванш');
    }
    
    // Если реванш уже выпадал 2 раза, исключаем его
    // Также исключаем призы с вероятностью 0
    let availablePrizes = revanchCount >= 2 
        ? prizes.filter(p => p.name !== 'Реванш' && p.probability > 0)
        : prizes.filter(p => p.probability > 0);
    
    // Сумма вероятностей всех доступных призов
    // 10%: 90, 20%: 5, 30%: 3, 40%: 0.5, 50%: 0.1, Реванш: 50, Продлённый путь: 9
    // Итого: 90 + 5 + 3 + 0.5 + 0.1 + 50 + 9 = 157.6
    // Используем их как веса (не нормализуем до 100%)
    const totalProb = availablePrizes.reduce((sum, p) => sum + p.probability, 0);
    const random = Math.random() * totalProb;
    
    console.log('Случайное число:', random, 'из', totalProb);
    
    let cumulative = 0;
    for (const prize of availablePrizes) {
        cumulative += prize.probability;
        console.log(`Проверка ${prize.name}: cumulative = ${cumulative}, random <= cumulative? ${random <= cumulative}`);
        if (random <= cumulative) {
            console.log('Выбран приз:', prize.name, 'с вероятностью', prize.probability);
            return prize;
        }
    }
    
    // Fallback - возвращаем первый доступный приз
    console.log('Fallback: возвращаем первый доступный приз');
    return availablePrizes[0];
}

// Вращение колеса
function spinWheel() {
    if (isSpinning) return;
    
    const state = getState();
    if (state.attemptsLeft <= 0) {
        showNoAttemptsModal();
        return;
    }
    
    isSpinning = true;
    const spinBtn = document.getElementById('spinBtn');
    spinBtn.disabled = true;
    
    // Выбираем приз по вероятностям
    const selectedPrize = selectPrize();
    console.log('Выбранный приз (по вероятностям):', selectedPrize.name, selectedPrize.displayName);
    
    // Сохраняем выбранный приз для использования после анимации
    window.selectedPrizeForSpin = selectedPrize;
    
    // Нормализуем текущую позицию колеса в диапазон [0, 2π]
    const normalizedCurrentRotation = ((currentRotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    
    // Используем реальные углы приза из массива (уже рассчитанные в calculateAngles)
    // Центр сектора приза в начальном положении колеса
    const prizeCenterAngle = selectedPrize.startAngle + (selectedPrize.endAngle - selectedPrize.startAngle) / 2;
    
    // Стрелка находится сверху (угол 3π/2 или -π/2)
    // Нужно повернуть колесо так, чтобы центр приза оказался под стрелкой
    // После вращения: (prizeCenterAngle + finalRotation) mod 2π должно быть равно 3π/2
    
    // Текущий угол центра приза с учетом текущего вращения
    const currentPrizeCenter = ((prizeCenterAngle + normalizedCurrentRotation) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    
    // Целевой угол (стрелка сверху)
    const targetAngle = 3 * Math.PI / 2;
    
    // Вычисляем, на сколько нужно повернуть от текущей позиции
    let angleToRotate = targetAngle - currentPrizeCenter;
    if (angleToRotate < 0) {
        angleToRotate += 2 * Math.PI;
    }
    
    // Количество оборотов для эффектности
    const turns = 6;
    
    // Финальный угол = текущая позиция + обороты + угол до остановки
    const finalAngle = normalizedCurrentRotation + turns * 2 * Math.PI + angleToRotate;
    
    // Общий поворот от текущей позиции (с учетом накопленного вращения)
    const totalRotation = finalAngle - currentRotation;
    
    console.log('Расчет остановки:');
    console.log('  Приз:', selectedPrize.name, selectedPrize.displayName);
    console.log('  Центр приза (начальный):', prizeCenterAngle, 'рад');
    console.log('  Текущая позиция (нормализованная):', normalizedCurrentRotation, 'рад');
    console.log('  Текущий центр приза:', currentPrizeCenter, 'рад');
    console.log('  Целевой угол (стрелка):', targetAngle, 'рад');
    console.log('  Угол до остановки:', angleToRotate, 'рад');
    console.log('  Всего оборотов:', turns);
    console.log('  Финальный угол:', finalAngle, 'рад');
    console.log('  Общий поворот:', totalRotation, 'рад');
    
    // Сохраняем prizeCenterAngle для использования в анимации
    const savedPrizeCenterAngle = prizeCenterAngle;
    
    // Анимация - используем логику из старого кода
    const duration = 6000; // Как в старом коде
    const startRotation = currentRotation;
    let startTime = null;
    
    function animate(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing из старого кода: 1 - Math.pow(1-progress,3)
        const easing = 1 - Math.pow(1 - progress, 3);
        
        // Применяем easing (как в старом коде: angle = finalAngle*easing)
        // В старом коде angle начинался с 0, finalAngle = stopAngle + turns*2*Math.PI
        // angle = finalAngle * easing (абсолютный угол)
        // В нашем случае нужно применить easing к разнице от startRotation
        const finalAngle = startRotation + totalRotation;
        currentRotation = startRotation + totalRotation * easing;
        
        drawWheel();
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Анимация завершена - устанавливаем точную финальную позицию
            currentRotation = startRotation + totalRotation;
            
            // Проверяем, что выбранный приз действительно под стрелкой
            const finalPrizeCenter = ((savedPrizeCenterAngle + currentRotation) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
            const targetAngle = 3 * Math.PI / 2;
            let error = finalPrizeCenter - targetAngle;
            
            // Нормализуем ошибку в диапазон [-π, π]
            if (error > Math.PI) error -= 2 * Math.PI;
            if (error < -Math.PI) error += 2 * Math.PI;
            
            // Небольшая коррекция если ошибка значительная
            if (Math.abs(error) > 0.01) {
                console.log('Коррекция угла на:', -error, 'рад');
                currentRotation -= error;
            }
            
            // Нормализуем позицию в диапазон [0, 2π] для следующего вращения
            currentRotation = ((currentRotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            
            // Проверяем финальную позицию
            const finalCheck = ((savedPrizeCenterAngle + currentRotation) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
            console.log('Проверка остановки:');
            console.log('  Финальный центр приза:', finalCheck, 'рад');
            console.log('  Целевой угол:', targetAngle, 'рад');
            console.log('  Ошибка:', Math.abs(finalCheck - targetAngle), 'рад');
            
            drawWheel();
            
            // Используем выбранный по вероятностям приз
            const prizeToShow = window.selectedPrizeForSpin || selectedPrize;
            console.log('Финальный приз:', prizeToShow.name, prizeToShow.displayName);
            console.log('Финальная позиция (нормализованная):', currentRotation, 'рад');
            finishSpin(prizeToShow);
            window.selectedPrizeForSpin = null;
        }
    }
    
    requestAnimationFrame(animate);
}

// Завершение вращения
function finishSpin(prize) {
    isSpinning = false;
    spinsCount++;
    
    // Фиксируем текущую позицию колеса - НЕ МЕНЯЕМ ЕЁ!
    // Колесо уже остановилось на правильном призе
    const finalRotation = currentRotation;
    
    const state = getState();
    const isRevanch = prize.name === 'Реванш';
    
    // Обновляем попытки (реванш не уменьшает)
    if (!isRevanch) {
        state.attemptsLeft = Math.max(0, state.attemptsLeft - 1);
    } else {
        state.revanchCount = (state.revanchCount || 0) + 1;
    }
    
    // Генерируем уникальный ключ защиты
    const protectionKey = generateProtectionKey();
    
    // Сохраняем результат и позицию колеса
    state.lastPrize = prize.name;
    state.lastSpinDate = Date.now();
    state.hasSpun = true;
    state.wheelRotation = finalRotation; // Сохраняем позицию колеса
    state.lastProtectionKey = protectionKey; // Сохраняем ключ защиты
    
    saveState(state);
    
    // Показываем результат
    showResult(prize, protectionKey);
    
    // Отправляем уведомление в Telegram (если доступен user_id)
    sendTelegramNotification(prize.name, protectionKey);
    
    // Разблокируем кнопки скачивания
    unlockDownloadButtons();
    
    // Обновляем UI (НО НЕ ПЕРЕРИСОВЫВАЕМ КОЛЕСО!)
    updateUI();
    
    // ВАЖНО: Сохраняем позицию колеса - оно уже на правильном призе
    // НЕ вызываем drawWheel() здесь - колесо уже нарисовано в конце анимации
    // Любая дополнительная перерисовка может сбросить позицию!
    currentRotation = finalRotation;
    
    const spinBtn = document.getElementById('spinBtn');
    spinBtn.disabled = false;
}

// Генерация ключа защиты
function generateProtectionKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Исключаем похожие символы
    let key = '';
    for (let i = 0; i < 8; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
}

// Показать результат
function showResult(prize, protectionKey) {
    const resultDisplay = document.getElementById('resultDisplay');
    const message = prizeMessages[prize.name] || 'Поздравляем с выигрышем!';
    resultDisplay.innerHTML = `
        <p class="result-text highlight">${message}</p>
        <p class="protection-key"><span class="key-value">${protectionKey}</span></p>
    `;
}

// Отправка уведомления в Telegram
async function sendTelegramNotification(prizeName, protectionKey) {
    try {
        // Получаем user_id из Telegram WebApp (если доступно)
        let userId = null;
        
        if (window.Telegram && window.Telegram.WebApp) {
            const webApp = window.Telegram.WebApp;
            if (webApp.initDataUnsafe && webApp.initDataUnsafe.user) {
                userId = webApp.initDataUnsafe.user.id;
            }
        }
        
        // Если user_id не найден, пытаемся получить из localStorage (если был сохранен ранее)
        if (!userId) {
            const savedUserId = localStorage.getItem('telegram_user_id');
            if (savedUserId) {
                userId = parseInt(savedUserId);
            }
        }
        
        // Если user_id все еще не найден, не отправляем уведомление
        if (!userId) {
            console.log('Telegram user_id не найден, уведомление не отправлено');
            return;
        }
        
        // URL сервера бота (замените на ваш реальный URL)
        const botServerUrl = 'http://localhost:5001'; // Или ваш production URL
        
        const response = await fetch(`${botServerUrl}/send_notification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: userId,
                prize_name: prizeName,
                protection_key: protectionKey
            })
        });
        
        if (response.ok) {
            console.log('Уведомление успешно отправлено в Telegram');
        } else {
            console.error('Ошибка при отправке уведомления:', await response.text());
        }
        
    } catch (error) {
        console.error('Ошибка при отправке уведомления в Telegram:', error);
        // Не показываем ошибку пользователю, просто логируем
    }
}

// Разблокировать кнопки скачивания
function unlockDownloadButtons() {
    const guideBtn = document.getElementById('downloadGuide');
    const glossaryBtn = document.getElementById('downloadGlossary');
    
    [guideBtn, glossaryBtn].forEach(btn => {
        if (btn.classList.contains('locked')) {
            btn.classList.remove('locked');
            btn.classList.add('unlocked');
            btn.disabled = false;
            
            const icon = btn.querySelector('i');
            icon.classList.remove('fa-lock');
            icon.classList.add('fa-unlock');
        }
    });
}

// Управление состоянием
function getState() {
    const defaultState = {
        attemptsLeft: 3,
        lastResetDate: Date.now(),
        lastPrize: null,
        lastSpinDate: null,
        hasSpun: false,
        revanchCount: 0,
        wheelRotation: 0
    };
    
    const saved = localStorage.getItem('wheelFortuneState');
    if (!saved) return defaultState;
    
    const state = JSON.parse(saved);
    
    // Убеждаемся, что все поля есть (для совместимости со старыми сохранениями)
    if (state.wheelRotation === undefined) {
        state.wheelRotation = 0;
    }
    
    // Проверяем, нужно ли обновить попытки (каждые 30 дней)
    const daysSinceReset = (Date.now() - state.lastResetDate) / (1000 * 60 * 60 * 24);
    if (daysSinceReset >= 30) {
        state.attemptsLeft = 3;
        state.lastResetDate = Date.now();
        state.revanchCount = 0;
        state.hasSpun = false;
        state.lastPrize = null;
        state.wheelRotation = 0;
    }
    
    return state;
}

function saveState(state) {
    localStorage.setItem('wheelFortuneState', JSON.stringify(state));
}

function getDaysUntilReset() {
    const state = getState();
    const daysSinceReset = (Date.now() - state.lastResetDate) / (1000 * 60 * 60 * 24);
    const daysLeft = 30 - daysSinceReset;
    return Math.max(0, Math.ceil(daysLeft));
}

// Обновление UI
function updateUI() {
    const state = getState();
    const spinBtn = document.getElementById('spinBtn');
    const spinBtnDesktop = document.getElementById('spinBtnDesktop');
    const buttons = [spinBtn, spinBtnDesktop].filter(btn => btn !== null);
    
    buttons.forEach(btn => {
        // Удаляем старый badge если есть
        const oldBadge = btn.querySelector('.attempts-badge');
        if (oldBadge) {
            oldBadge.remove();
        }
        
        if (state.attemptsLeft > 0) {
            btn.disabled = false;
            
            // Новая логика отображения текста кнопки
            if (!state.hasSpun) {
                // Если еще не было ни одного спина
                btn.textContent = 'Испытаем удачу?';
            } else if (state.attemptsLeft === 1) {
                // Осталась последняя попытка
                btn.textContent = 'Осталась последняя попытка';
            } else if (state.attemptsLeft === 2) {
                // Осталось 2 попытки
                btn.textContent = 'Осталось 2 попытки';
            } else {
                // Осталось 3 или больше попыток (это возможно только если были реванши)
                btn.innerHTML = `Крутить колесо<span class="attempts-badge">${state.attemptsLeft}</span>`;
            }
        } else {
            btn.disabled = true;
            btn.textContent = 'Попытки закончились';
        }
    });
    
    // Если уже крутили, разблокируем кнопки
    if (state.hasSpun) {
        unlockDownloadButtons();
    } else {
        // Блокируем кнопки если еще не крутили
        const guideBtn = document.getElementById('downloadGuide');
        const glossaryBtn = document.getElementById('downloadGlossary');
        [guideBtn, glossaryBtn].forEach(btn => {
            btn.classList.add('locked');
            btn.classList.remove('unlocked');
            btn.disabled = true;
            const icon = btn.querySelector('i');
            icon.classList.remove('fa-unlock');
            icon.classList.add('fa-lock');
        });
    }
    
    // НЕ перерисовываем колесо здесь - это может сбросить позицию!
}

// Функция для сброса попыток (для тестирования)
function resetAttempts() {
    const state = {
        attemptsLeft: 3,
        lastResetDate: Date.now(),
        lastPrize: null,
        lastSpinDate: null,
        hasSpun: false,
        revanchCount: 0,
        wheelRotation: 0
    };
    localStorage.setItem('wheelFortuneState', JSON.stringify(state));
    currentRotation = 0;
    spinsCount = 0;
    drawWheel();
    updateUI();
    
    // Блокируем кнопки обратно
    const guideBtn = document.getElementById('downloadGuide');
    const glossaryBtn = document.getElementById('downloadGlossary');
    [guideBtn, glossaryBtn].forEach(btn => {
        btn.classList.add('locked');
        btn.classList.remove('unlocked');
        btn.disabled = true;
        const icon = btn.querySelector('i');
        icon.classList.remove('fa-unlock');
        icon.classList.add('fa-lock');
    });
    
    const resultDisplay = document.getElementById('resultDisplay');
    resultDisplay.innerHTML = '<p class="result-text"></p>';
    
    console.log('Попытки сброшены!');
}

// Делаем функцию доступной в консоли для тестирования
window.resetAttempts = resetAttempts;

// Также добавляем алиас на случай опечатки
window.resetAttemps = resetAttempts;

// Настройка обработчиков событий
function setupEventListeners() {
    // Добавляем обработчик для обеих кнопок (мобильная и десктопная)
    const spinBtn = document.getElementById('spinBtn');
    const spinBtnDesktop = document.getElementById('spinBtnDesktop');
    if (spinBtn) {
        spinBtn.addEventListener('click', spinWheel);
    }
    if (spinBtnDesktop) {
        spinBtnDesktop.addEventListener('click', spinWheel);
    }
    
    document.getElementById('submitResults').addEventListener('click', () => {
        const state = getState();
        if (state.lastPrize) {
            // Открываем Telegram бота
            window.open('https://t.me/apevault_ecosystem_bot', '_blank');
        } else {
            alert('Сначала прокрутите колесо!');
        }
    });
    
    document.getElementById('downloadGuide').addEventListener('click', function() {
        if (!this.disabled) {
            // Здесь можно добавить ссылку на файл
            alert('Скачивание гайда по алертам...');
        }
    });
    
    document.getElementById('downloadGlossary').addEventListener('click', function() {
        if (!this.disabled) {
            // Здесь можно добавить ссылку на файл
            alert('Скачивание крипто-глоссария...');
        }
    });
}

// Настройка FAQ
function setupFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Закрываем все остальные
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Переключаем текущий
            item.classList.toggle('active', !isActive);
        });
    });
}

// Показать модальное окно о закончившихся попытках
function showNoAttemptsModal() {
    const modal = document.getElementById('noAttemptsModal');
    const daysLeft = getDaysUntilReset();
    const daysElement = document.getElementById('modalDaysLeft');
    
    if (daysElement) {
        daysElement.textContent = daysLeft;
    }
    
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Блокируем прокрутку страницы
    }
}

// Скрыть модальное окно
function hideNoAttemptsModal() {
    const modal = document.getElementById('noAttemptsModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = ''; // Разблокируем прокрутку
    }
}

// Настройка модального окна
function setupModal() {
    const modal = document.getElementById('noAttemptsModal');
    const closeBtn = document.getElementById('closeModal');
    
    // Закрытие по кнопке
    if (closeBtn) {
        closeBtn.addEventListener('click', hideNoAttemptsModal);
    }
    
    // Закрытие по клику вне модального окна
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideNoAttemptsModal();
            }
        });
    }
    
    // Закрытие по Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
            hideNoAttemptsModal();
        }
    });
    
    // Настройка модального окна запроса разрешения
    setupPermissionModal();
}

// Настройка модального окна запроса разрешения
function setupPermissionModal() {
    const permissionModal = document.getElementById('permissionModal');
    const grantBtn = document.getElementById('grantPermissionBtn');
    const skipBtn = document.getElementById('skipPermissionBtn');
    
    if (!permissionModal || !grantBtn || !skipBtn) return;
    
    // Обработка кнопки "Разрешить"
    grantBtn.addEventListener('click', () => {
        requestWriteAccess();
    });
    
    // Обработка кнопки "Запретить"
    skipBtn.addEventListener('click', () => {
        denyPermission();
    });
    
    // Предотвращаем закрытие по клику на overlay
    // Пользователь должен сделать выбор (разрешить или пропустить)
    permissionModal.addEventListener('click', (e) => {
        if (e.target === permissionModal) {
            // Не закрываем модальное окно при клике на overlay
            // Пользователь должен нажать на одну из кнопок
            e.stopPropagation();
        }
    });
    
    // Не разрешаем закрытие по Escape - пользователь должен сделать выбор
}

// Проверка и показ запроса разрешения
function checkAndRequestPermission() {
    // Проверяем, есть ли Telegram WebApp
    if (!window.Telegram || !window.Telegram.WebApp) {
        return;
    }
    
    const webApp = window.Telegram.WebApp;
    
    // Проверяем, уже было ли запрошено разрешение
    const permissionAsked = localStorage.getItem('telegram_write_access_asked');
    
    // Проверяем, есть ли уже разрешение
    if (webApp.canSendMessage) {
        localStorage.setItem('telegram_write_access', 'granted');
        return;
    }
    
    // Если разрешение уже было запрошено и разрешено, не показываем модальное окно снова
    if (permissionAsked === 'true') {
        const accessStatus = localStorage.getItem('telegram_write_access');
        // Если разрешение было запрещено (denied), удаляем флаги чтобы снова спросить при следующем запуске
        if (accessStatus === 'denied') {
            // Не показываем окно, если было запрещено - пользователь уже решил
            return;
        } else if (accessStatus === 'granted') {
            // Если разрешение уже дано, не показываем окно
            return;
        }
        // Если статус неопределен, показываем окно снова
    }
    
    // Показываем модальное окно запроса разрешения
    showPermissionModal();
}

// Показать модальное окно запроса разрешения
function showPermissionModal() {
    const permissionModal = document.getElementById('permissionModal');
    if (permissionModal) {
        permissionModal.classList.add('active');
    }
}

// Закрыть модальное окно запроса разрешения
function closePermissionModal() {
    const permissionModal = document.getElementById('permissionModal');
    if (permissionModal) {
        permissionModal.classList.remove('active');
        localStorage.setItem('telegram_write_access_asked', 'true');
    }
}

// Запрос разрешения на отправку сообщений
function requestWriteAccess() {
    if (!window.Telegram || !window.Telegram.WebApp) {
        console.error('Telegram WebApp не доступен');
        showPermissionError('Telegram WebApp не доступен');
        return;
    }
    
    const webApp = window.Telegram.WebApp;
    const grantBtn = document.getElementById('grantPermissionBtn');
    
    // Показываем состояние загрузки
    if (grantBtn) {
        grantBtn.disabled = true;
        grantBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Запрос...';
    }
    
    // Запрашиваем разрешение
    console.log('Запрос разрешения на отправку сообщений...');
    
    // Проверяем, доступен ли метод
    if (typeof webApp.requestWriteAccess !== 'function') {
        console.error('Метод requestWriteAccess не доступен');
        showPermissionError('Функция запроса разрешения недоступна. Пожалуйста, обновите Telegram.');
        if (grantBtn) {
            grantBtn.disabled = false;
            grantBtn.innerHTML = 'Разрешить';
        }
        return;
    }
    
    // Используем правильный синтаксис для requestWriteAccess
    webApp.requestWriteAccess().then((res) => {
        console.log('Результат запроса разрешения:', res);
        
        if (res) {
            console.log("Write Access granted");
            localStorage.setItem('telegram_write_access', 'granted');
            localStorage.setItem('telegram_write_access_asked', 'true');
            
            // Проверяем статус разрешения
            if (webApp.canSendMessage) {
                console.log('✅ canSendMessage подтверждено');
            }
            
            // Обновляем UI модального окна с сообщением об успехе
            updatePermissionModalSuccess();
            
            // Закрываем модальное окно через 1.5 секунды
            setTimeout(() => {
                closePermissionModal();
            }, 1500);
        } else {
            console.log("Write Access denied");
            localStorage.setItem('telegram_write_access', 'denied');
            localStorage.setItem('telegram_write_access_asked', 'true');
            showPermissionError('Разрешение не было предоставлено');
            
            if (grantBtn) {
                grantBtn.disabled = false;
                grantBtn.innerHTML = 'Разрешить';
            }
            
            setTimeout(() => {
                closePermissionModal();
            }, 2000);
        }
    }).catch((error) => {
        console.error('❌ Ошибка при запросе разрешения:', error);
        showPermissionError('Ошибка при запросе разрешения: ' + (error.message || error));
        
        if (grantBtn) {
            grantBtn.disabled = false;
            grantBtn.innerHTML = 'Разрешить';
        }
        
        setTimeout(() => {
            closePermissionModal();
        }, 2000);
    });
}

// Показать ошибку при запросе разрешения
function showPermissionError(message) {
    const permissionModal = document.getElementById('permissionModal');
    if (!permissionModal) return;
    
    const content = permissionModal.querySelector('.modal-content');
    if (content) {
        content.innerHTML = `
            <div class="modal-icon" style="background: linear-gradient(135deg, rgba(220, 53, 69, 0.2) 0%, rgba(220, 53, 69, 0.1) 100%);">
                <i class="fas fa-exclamation-triangle" style="color: #dc3545;"></i>
            </div>
            <h2 class="modal-title">Ошибка</h2>
            <p class="modal-text">
                ${message}
            </p>
            <p class="modal-text-secondary">
                Попробуйте снова или обратитесь в поддержку.
            </p>
        `;
    }
}

// Запретить разрешение и закрыть мини-приложение
function denyPermission() {
    console.log('Пользователь запретил доступ');
    
    // Удаляем все флаги, чтобы при следующем запуске снова показать запрос
    localStorage.removeItem('telegram_write_access_asked');
    localStorage.removeItem('telegram_write_access');
    localStorage.removeItem('telegram_write_access_denied');
    
    // Закрываем модальное окно
    const permissionModal = document.getElementById('permissionModal');
    if (permissionModal) {
        permissionModal.classList.remove('active');
    }
    
    // Небольшая задержка перед закрытием мини-приложения для плавности
    setTimeout(() => {
        // Закрываем мини-приложение
        if (window.Telegram && window.Telegram.WebApp) {
            const webApp = window.Telegram.WebApp;
            try {
                console.log('Закрытие мини-приложения...');
                webApp.close();
            } catch (error) {
                console.error('Ошибка при закрытии мини-приложения:', error);
                // Если не удалось закрыть программно, показываем сообщение
                alert('Для корректной работы приложения требуется разрешение на отправку сообщений. Пожалуйста, перезапустите приложение.');
            }
        } else {
            console.error('Telegram WebApp недоступен');
        }
    }, 300);
}

// Обновление UI модального окна после успешного получения разрешения
function updatePermissionModalSuccess() {
    const permissionModal = document.getElementById('permissionModal');
    if (!permissionModal) return;
    
    const content = permissionModal.querySelector('.modal-content');
    if (content) {
        content.innerHTML = `
            <div class="modal-icon" style="background: linear-gradient(135deg, rgba(78, 110, 73, 0.3) 0%, rgba(78, 110, 73, 0.2) 100%);">
                <i class="fas fa-check" style="color: #4E6E49;"></i>
            </div>
            <h2 class="modal-title">Разрешение получено!</h2>
            <p class="modal-text">
                Теперь бот сможет отправлять вам уведомления о выигрышах.
            </p>
        `;
    }
}

// Перерисовка при изменении размера окна
window.addEventListener('resize', () => {
    drawWheel();
});
