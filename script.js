(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const screens = ['welcomeScreen', 'giftScreen', 'starsScreen', 'checklistScreen', 'birthdayScreen', 'finaleScreen'].map(id => document.getElementById(id));
  const bottomProgress = $('#bottomProgress');
  const confettiLayer = $('#confettiLayer');
  const toast = $('#toast');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let currentScreen = 0;
  let starsFound = new Set();
  let tasksDone = new Set();
  let wordsRevealed = new Set();
  let toastTimer;
  let noCount = 0;

  const progressByScreen = [0, 20, 40, 60, 80, 100];

  function showScreen(index, { burst = false } = {}) {
    if (index < 0 || index >= screens.length) return;
    currentScreen = index;
    screens.forEach((screen, i) => {
      const active = i === index;
      screen.hidden = false;
      requestAnimationFrame(() => {
        screen.classList.toggle('active', active);
        if (!active) {
          window.setTimeout(() => {
            if (currentScreen !== i) screen.hidden = true;
          }, 900);
        }
      });
    });
    bottomProgress.style.width = `${progressByScreen[index]}%`;
    if (burst) confetti(95);
    if (index === 5) window.setTimeout(() => confetti(130, $('#finalConfetti')), reduceMotion ? 0 : 350);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function confetti(amount = 80, target = confettiLayer) {
    if (reduceMotion) return;
    const colors = ['#65b8e5', '#a4ddf4', '#ffd65f', '#fff1b8', '#ffffff', '#f6c5d5', '#7ec9b3'];
    for (let i = 0; i < amount; i++) {
      const bit = document.createElement('span');
      bit.className = 'confetti' + (Math.random() > .82 ? ' round' : '');
      bit.style.left = `${Math.random() * 100}%`;
      bit.style.background = colors[Math.floor(Math.random() * colors.length)];
      bit.style.setProperty('--fall', `${2.1 + Math.random() * 2.2}s`);
      bit.style.setProperty('--drift', `${Math.random() * 230 - 115}px`);
      bit.style.setProperty('--spin', `${Math.random() * 1100 - 550}deg`);
      bit.style.setProperty('--rot', `${Math.random() * 90}deg`);
      bit.style.animationDelay = `${Math.random() * .45}s`;
      bit.style.width = `${5 + Math.random() * 7}px`;
      bit.style.height = `${7 + Math.random() * 10}px`;
      target.appendChild(bit);
      bit.addEventListener('animationend', () => bit.remove(), { once: true });
    }
    // Avoid accumulating animated nodes if a browser omits animationend when the tab is hidden.
    setTimeout(() => { $$('.confetti', target).forEach(node => node.remove()); }, 5200);
  }

  function vibrate(pattern = [25, 30, 40]) {
    // Safari/iOS may not expose the Vibration API; visuals do not depend on it.
    if ('vibrate' in navigator) {
      try { navigator.vibrate(pattern); } catch (_) { /* unsupported by device */ }
    }
  }

  function resetAll() {
    starsFound = new Set();
    tasksDone = new Set();
    wordsRevealed = new Set();
    noCount = 0;
    $('#noMessage').textContent = '';
    $('#noButton').style.opacity = '1';
    $('#noButton').style.transform = '';
    $('#noButton').style.width = '';
    $('#noButton').style.paddingLeft = '';
    $('#noButton').style.paddingRight = '';
    $('#noButton').style.borderWidth = '';
    $('#noButton').style.marginLeft = '';
    $('#noButton').style.pointerEvents = '';
    $('#yesButton').style.transform = '';
    $('#openGiftButton').innerHTML = 'Открыть коробочку <span>✦</span>';
    $('#openGiftButton').disabled = false;
    $('.welcome-art').style.transform = ''; 
    $('#bigGift').parentElement.classList.remove('opened');
    $('#wishReveal').classList.remove('visible');
    $$('.collect-star').forEach(star => {
      star.classList.remove('found');
      star.disabled = false;
    });
    $('#starCount').textContent = '0';
    $('#counterFill').style.width = '0%';
    $('#secretReveal').classList.remove('visible');
    $('#starFieldHint').textContent = 'ИЩИ ИСКРЫ · НАЖИМАЙ НА НИХ';
    $$('.task-row').forEach(task => {
      task.classList.remove('done');
      task.setAttribute('aria-pressed', 'false');
    });
    $('#taskProgressText').textContent = '0 из 3 подтверждено';
    $('#taskProgressBar').style.width = '0%';
    $('#approvedPill').textContent = 'НА ПРОВЕРКЕ';
    $('#approvedPill').classList.remove('done');
    $('#toBirthdayButton').disabled = true;
    $$('.spoiler-word').forEach(word => word.classList.remove('revealed'));
    $$('.word-progress span').forEach(pill => pill.classList.remove('filled'));
    $('#birthdayInstruction').textContent = 'Открывай слова по одному. И желательно с пафосом.';
    $('#scrollFinalButton').hidden = true;
    $$('.confetti').forEach(node => node.remove());
    showScreen(0);
  }

  $('#yesButton').addEventListener('click', () => {
    showScreen(1, { burst: true });
    showToast('Так-то лучше 😌');
  });

  $('#noButton').addEventListener('click', () => {
    noCount += 1;
    const messages = [
      'ХУЙ ТЕБЕ, ДЛЯ КОГО Я СТАРАЛСЯ 😭',
      'Олечка, кнопка «Да» вообще-то симпатичная…',
      'Ладно, всё. Остался только правильный ответ 😌'
    ];
    $('#noMessage').textContent = messages[Math.min(noCount - 1, messages.length - 1)];
    const noButton = $('#noButton');
    const yesButton = $('#yesButton');
    const shrink = Math.max(.05, 1 - noCount * .31);
    noButton.style.transform = `scale(${shrink})`;
    noButton.style.opacity = String(Math.max(0, 1 - noCount * .36));
    yesButton.style.transform = `scale(${1 + Math.min(noCount, 3) * .06})`;
    if (noCount >= 3) {
      noButton.style.pointerEvents = 'none';
      noButton.style.width = '0';
      noButton.style.paddingLeft = '0';
      noButton.style.paddingRight = '0';
      noButton.style.borderWidth = '0';
      noButton.style.marginLeft = '-12px';
    }
  });

  $('#heroGift').addEventListener('click', () => {
    const gift = $('#heroGift');
    gift.animate([
      { transform: 'translateY(0) rotate(0deg)' },
      { transform: 'translateY(-7px) rotate(-5deg)' },
      { transform: 'translateY(0) rotate(4deg)' },
      { transform: 'translateY(0) rotate(-1deg)' }
    ], { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)' });
    showToast('Терпение, подарок пока запечатан ✨');
  });

  $('#openGiftButton').addEventListener('click', () => {
    const stage = $('.gift-stage');
    if (stage.classList.contains('opened')) return;
    stage.classList.add('opened');
    $('#wishReveal').classList.add('visible');
    $('#openGiftButton').innerHTML = 'Подарок открыт <span>✓</span>';
    $('#openGiftButton').disabled = true;
    confetti(40);
    vibrate([18, 25, 35]);
  });

  $('#toStarsButton').addEventListener('click', () => showScreen(2, { burst: true }));

  $$('.collect-star').forEach(star => {
    star.addEventListener('click', () => {
      const id = Number(star.dataset.star);
      if (starsFound.has(id)) return;
      starsFound.add(id);
      star.classList.add('found');
      star.disabled = true;
      $('#starCount').textContent = String(starsFound.size);
      $('#counterFill').style.width = `${starsFound.size / 5 * 100}%`;
      const pop = $('#collectPop');
      pop.classList.remove('show');
      void pop.offsetWidth;
      pop.textContent = starsFound.size === 5 ? 'Все искры собраны!' : '+1 искра!';
      pop.classList.add('show');
      if (starsFound.size < 5) {
        confetti(10);
        vibrate(18);
      } else {
        $('#secretReveal').classList.add('visible');
        $('#starFieldHint').textContent = 'УРА! ТЫ НАШЛА ВСЕ ИСКРЫ ✨';
        confetti(75);
        vibrate([30, 35, 55]);
        showToast('Секрет разблокирован 💛');
      }
    });
  });

  $('#toChecklistButton').addEventListener('click', () => showScreen(3, { burst: true }));

  $$('.task-row').forEach(task => {
    task.addEventListener('click', () => {
      const id = Number(task.dataset.task);
      if (tasksDone.has(id)) tasksDone.delete(id); else tasksDone.add(id);
      const done = tasksDone.has(id);
      task.classList.toggle('done', done);
      task.setAttribute('aria-pressed', String(done));
      $('#taskProgressText').textContent = `${tasksDone.size} из 3 подтверждено`;
      $('#taskProgressBar').style.width = `${tasksDone.size / 3 * 100}%`;
      const allDone = tasksDone.size === 3;
      $('#approvedPill').textContent = allDone ? 'ОДОБРЕНО ✓' : 'НА ПРОВЕРКЕ';
      $('#approvedPill').classList.toggle('done', allDone);
      $('#toBirthdayButton').disabled = !allDone;
      if (done) {
        vibrate(18);
        if (allDone) {
          confetti(35);
          showToast('Официально: Оля — красотка ✅');
        }
      }
    });
  });

  $('#toBirthdayButton').addEventListener('click', () => showScreen(4, { burst: true }));

  $$('.spoiler-word').forEach(button => {
    button.addEventListener('click', () => {
      const id = Number(button.dataset.word);
      if (wordsRevealed.has(id)) return;
      wordsRevealed.add(id);
      button.classList.add('revealed');
      button.setAttribute('aria-pressed', 'true');
      const progress = $$('.word-progress span');
      if (progress[id]) progress[id].classList.add('filled');
      confetti(id === 0 ? 48 : 72);
      vibrate([20, 25, 35, 20]);
      if (wordsRevealed.size === 1) {
        $('#birthdayInstruction').textContent = 'Одна часть открыта. Ну давай, добивай эффектно ✨';
      } else {
        $('#birthdayInstruction').textContent = 'ВОТ ТЕПЕРЬ МОЖНО ПОЗДРАВЛЯТЬ ПО-НАСТОЯЩЕМУ! 🎉';
        $('#scrollFinalButton').hidden = false;
        confetti(60);
        showToast('С днём рождения, Оля! 🎉');
      }
    });
  });

  $('#scrollFinalButton').addEventListener('click', () => showScreen(5, { burst: true }));
  $('#replayButton').addEventListener('click', resetAll);

  // Allow keyboard testing on a computer and keep the experience usable in landscape on phones.
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && currentScreen > 0) showToast('Продолжай — всё впереди ✨');
    if ((event.key === 'Enter' || event.key === ' ') && event.target === $('#heroGift')) {
      event.preventDefault();
      $('#heroGift').click();
    }
  });

  // A small parallax nudge on wide screens makes the cover feel alive without being distracting.
  if (window.matchMedia('(pointer:fine)').matches && !reduceMotion) {
    let pointerFrame = 0;
    document.addEventListener('pointermove', event => {
      if (currentScreen !== 0 || pointerFrame) return;
      pointerFrame = requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth - .5) * 7;
        const y = (event.clientY / window.innerHeight - .5) * 7;
        $('.welcome-art').style.transform = `translate(${x}px, ${y}px)`;
        pointerFrame = 0;
      });
    }, { passive: true });
  }

  // Make the opening screen responsive to orientation changes without reloading.
  window.addEventListener('orientationchange', () => {
    document.body.classList.toggle('is-landscape', window.innerWidth > window.innerHeight);
  }, { passive: true });
})();
