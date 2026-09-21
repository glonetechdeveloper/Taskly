/**
 * Taskly Landing Page Scripts
 * Interactive slider, tabs, FAQ accordion, and micro-interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Interactive Comparison Split Slider (Hero Showcase)
  initSplitSlider();

  // 2. Browser Mockup Tabs Switching
  initBrowserTabs();

  // 3. Solution Feature Switching
  initSolutionFeatures();

  // 4. FAQ Accordion
  initFaqAccordion();

  // 5. Soundwave/Streak Meter animation
  initStreakWave();
});

/**
 * Split Image Comparison Slider with drag & touch support
 */
let setSliderPosition = null;

function initSplitSlider() {
  const container = document.getElementById('splitSlider');
  const afterImg = document.getElementById('sliderAfter');
  const handle = document.getElementById('sliderHandle');
  if (!container || !afterImg || !handle) return;

  let isDragging = false;

  function updateSlider(clientX) {
    const rect = container.getBoundingClientRect();
    let x = clientX - rect.left;
    if (x < 0) x = 0;
    if (x > rect.width) x = rect.width;

    const percent = (x / rect.width) * 100;
    handle.style.left = `${percent}%`;
    afterImg.style.clipPath = `polygon(0 0, ${percent}% 0, ${percent}% 100%, 0 100%)`;
  }

  setSliderPosition = function(percent) {
    handle.style.transition = 'left 0.35s ease';
    afterImg.style.transition = 'clip-path 0.35s ease';
    handle.style.left = `${percent}%`;
    afterImg.style.clipPath = `polygon(0 0, ${percent}% 0, ${percent}% 100%, 0 100%)`;
    setTimeout(() => {
      handle.style.transition = 'none';
      afterImg.style.transition = 'none';
    }, 360);
  };

  function onPointerDown(e) {
    isDragging = true;
    handle.style.transition = 'none';
    afterImg.style.transition = 'none';
    updateSlider(e.touches ? e.touches[0].clientX : e.clientX);
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    updateSlider(e.touches ? e.touches[0].clientX : e.clientX);
  }

  function onPointerUp() {
    isDragging = false;
  }

  container.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);

  container.addEventListener('touchstart', onPointerDown, { passive: true });
  window.addEventListener('touchmove', onPointerMove, { passive: true });
  window.addEventListener('touchend', onPointerUp);
}

/**
 * Browser header tab controls
 */
function initBrowserTabs() {
  const tabBtns = document.querySelectorAll('.browser-tab-btn');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const view = btn.dataset.view;
      if (!setSliderPosition) return;

      if (view === 'split') {
        setSliderPosition(50);
      } else if (view === 'dashboard') {
        setSliderPosition(0);
      } else if (view === 'roadmap') {
        setSliderPosition(100);
      }
    });
  });
}

/**
 * Feature list item click switches screenshot
 */
function initSolutionFeatures() {
  const cards = document.querySelectorAll('.feature-card');
  const previewImg = document.getElementById('solutionPreviewImg');
  if (!previewImg || !cards.length) return;

  const images = {
    '0': 'assets/screenshot3.png',
    '1': 'assets/screenshot4.png',
    '2': 'assets/screenshot5.png'
  };

  cards.forEach((card, index) => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      if (images[index]) {
        previewImg.style.opacity = '0';
        setTimeout(() => {
          previewImg.src = images[index];
          previewImg.style.opacity = '1';
        }, 180);
      }
    });
  });
}

/**
 * FAQ Accordion toggle
 */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (!question) return;

    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      faqItems.forEach(other => other.classList.remove('open'));
      if (!isOpen) {
        item.classList.add('open');
      }
    });
  });
}

/**
 * Streak Wave animation in dark section
 */
function initStreakWave() {
  const waveBars = document.querySelectorAll('.wave-bar');
  if (!waveBars.length) return;

  const heights = [24, 45, 65, 35, 75, 50, 85, 40, 60, 90, 70, 45, 80, 55, 68, 95];
  waveBars.forEach((bar, idx) => {
    bar.style.height = `${heights[idx % heights.length]}px`;
  });
}
