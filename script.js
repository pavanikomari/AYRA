/**
 * AYRA – Her Voice. Her Rights. Her Rise.
 * Official Client-Side JavaScript
 * Fully interactive, accessible, and responsive
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // =========================================================================
  // 1. STATE & UTILITIES
  // =========================================================================
  const state = {
    currentLang: 'en',
    cart: [],
    speechSynth: window.speechSynthesis || null,
    currentUtterance: null,
    isSpeaking: false
  };

  // Set Current Year in Footer
  const currentYearEl = document.getElementById('currentYear');
  if (currentYearEl) {
    currentYearEl.textContent = new Date().getFullYear();
  }

  // Toast Notification Dispatcher
  function showToast(message, type = 'info', icon = 'fa-circle-info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i class="fa-solid ${icon}"></i>
      <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // =========================================================================
  // 2. STICKY HEADER & SCROLL SPY
  // =========================================================================
  const header = document.getElementById('header');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[id], header[id]');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    // ScrollSpy active state
    let currentId = 'home';
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 120;
      const sectionHeight = section.offsetHeight;
      if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
        currentId = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${currentId}`) {
        link.classList.add('active');
      }
    });
  }, { passive: true });

  // =========================================================================
  // 3. RESPONSIVE MOBILE DRAWER
  // =========================================================================
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileDrawer = document.getElementById('mobileDrawer');
  const drawerCloseBtn = document.getElementById('drawerCloseBtn');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  const drawerLinks = document.querySelectorAll('.drawer-link');
  const drawerSupportBtn = document.getElementById('drawerSupportBtn');

  function openDrawer() {
    mobileDrawer.classList.add('active');
    drawerBackdrop.classList.add('active');
    mobileMenuBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    mobileDrawer.classList.remove('active');
    drawerBackdrop.classList.remove('active');
    mobileMenuBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', openDrawer);
  if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeDrawer);
  if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);

  drawerLinks.forEach(link => {
    link.addEventListener('click', closeDrawer);
  });

  if (drawerSupportBtn) {
    drawerSupportBtn.addEventListener('click', () => {
      closeDrawer();
      openModal(document.getElementById('supportModal'));
    });
  }

  // =========================================================================
  // 4. LANGUAGE SELECTOR & LOCALIZATION SIMULATION
  // =========================================================================
  const languageSelect = document.getElementById('languageSelect');
  const voiceLangSelect = document.getElementById('voiceLangSelect');

  const languageLabels = {
    en: { name: 'English (India)', notice: 'Interface language set to English (India).' },
    hi: { name: 'हिंदी (Hindi)', notice: 'इंटरफ़ेस भाषा हिंदी में चुनी गई है। सभी मुख्य मार्गदर्शिकाएँ उपलब्ध हैं।' },
    ta: { name: 'தமிழ் (Tamil)', notice: 'இடைமுக மொழி தமிழ் என அமைக்கப்பட்டுள்ளது.' },
    bn: { name: 'বাংলা (Bengali)', notice: 'ইন্টারফেস ভাষা বাংলায় সেট করা হয়েছে।' },
    te: { name: 'తెలుగు (Telugu)', notice: 'ఇంటర్ఫేస్ భాష తెలుగుగా మార్చబడింది.' },
    mr: { name: 'मराठी (Marathi)', notice: 'इंटरफेस भाषा मराठीत सेट केली आहे.' },
    kn: { name: 'ಕನ್ನಡ (Kannada)', notice: 'ಇಂಟರ್‌ಫೇಸ್ ಭಾಷೆಯನ್ನು ಕನ್ನಡಕ್ಕೆ ಹೊಂದಿಸಲಾಗಿದೆ.' }
  };

  if (languageSelect) {
    languageSelect.addEventListener('change', (e) => {
      const selected = e.target.value;
      state.currentLang = selected;
      const langInfo = languageLabels[selected] || languageLabels.en;
      showToast(langInfo.notice, 'info', 'fa-language');

      // Sync with voice widget language if available
      if (voiceLangSelect) {
        if (selected === 'hi') voiceLangSelect.value = 'hi-IN';
        else if (selected === 'ta') voiceLangSelect.value = 'ta-IN';
        else if (selected === 'bn') voiceLangSelect.value = 'bn-IN';
        else if (selected === 'te') voiceLangSelect.value = 'te-IN';
        else if (selected === 'mr') voiceLangSelect.value = 'mr-IN';
        else voiceLangSelect.value = 'en-IN';
      }
    });
  }

  // =========================================================================
  // 5. BROWSER SPEECH SYNTHESIS & READ-ALOUD ENGINE
  // =========================================================================
  const btnAudioOverview = document.getElementById('btnAudioOverview');
  const voiceVisualizer = document.getElementById('voiceVisualizer');
  const voicePulse = document.getElementById('voicePulse');
  const voiceStatusText = document.getElementById('voiceStatusText');

  function stopSpeaking() {
    if (state.speechSynth && state.speechSynth.speaking) {
      state.speechSynth.cancel();
    }
    state.isSpeaking = false;
    if (voiceVisualizer) voiceVisualizer.classList.remove('active');
    if (voicePulse) voicePulse.classList.remove('speaking');
    if (voiceStatusText) voiceStatusText.textContent = 'AYRA Voice Ready';
  }

  function speakText(text, lang = 'en-IN') {
    if (!state.speechSynth) {
      showToast('Text-to-speech is not supported on this browser.', 'warning', 'fa-triangle-exclamation');
      return;
    }

    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    // Look for Indian or preferred English/Hindi voices
    const voices = state.speechSynth.getVoices();
    const preferredVoice = voices.find(v => v.lang.includes(lang.split('-')[0])) || null;
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => {
      state.isSpeaking = true;
      if (voiceVisualizer) voiceVisualizer.classList.add('active');
      if (voicePulse) voicePulse.classList.add('speaking');
      if (voiceStatusText) voiceStatusText.textContent = 'Speaking...';
    };

    utterance.onend = () => {
      stopSpeaking();
    };

    utterance.onerror = () => {
      stopSpeaking();
    };

    state.currentUtterance = utterance;
    state.speechSynth.speak(utterance);
  }

  // Header "Listen to Page" Button
  if (btnAudioOverview) {
    btnAudioOverview.addEventListener('click', () => {
      if (state.isSpeaking) {
        stopSpeaking();
        showToast('Speech paused', 'info');
      } else {
        const pageSummary = "Welcome to AYRA. Her Voice, Her Rights, Her Rise. We are a national empowerment platform for women in India. Explore simplified legal rights, educational scholarships, central government schemes, and 24/7 verified emergency helplines.";
        speakText(pageSummary, 'en-IN');
        showToast('Reading AYRA overview aloud...', 'info', 'fa-volume-high');
      }
    });
  }

  // Rights Card Read Aloud Buttons
  const readAloudButtons = document.querySelectorAll('.btn-read-aloud');
  readAloudButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const textToSpeak = btn.getAttribute('data-speak');
      if (textToSpeak) {
        speakText(textToSpeak, 'en-IN');
        showToast('Reading legal guide aloud...', 'info', 'fa-volume-high');
      }
    });
  });

  // Stop Audio Button in Voice Assistant
  const btnStopAudio = document.getElementById('btnStopAudio');
  if (btnStopAudio) {
    btnStopAudio.addEventListener('click', () => {
      stopSpeaking();
      showToast('Speech stopped', 'info', 'fa-circle-stop');
    });
  }

  // =========================================================================
  // 6. GLOBAL LIVE SEARCH MODAL & INDEX
  // =========================================================================
  const searchToggleBtn = document.getElementById('searchToggleBtn');
  const searchOverlay = document.getElementById('searchOverlay');
  const searchCloseBtn = document.getElementById('searchCloseBtn');
  const globalSearchInput = document.getElementById('globalSearchInput');
  const searchResultsBox = document.getElementById('searchResultsBox');
  const queryChips = document.querySelectorAll('.chip-query');

  const searchableData = [
    { title: 'POSH Act 2013 (Workplace Harassment)', section: '#rights', category: 'Legal Rights', desc: 'Mandatory Internal Committee, 90-day inquiry, protection from retaliation.' },
    { title: 'Zero FIR Rights', section: '#rights', category: 'Police & FIR', desc: 'File First Information Report at any police station across India.' },
    { title: 'Protection from Domestic Violence Act 2005', section: '#rights', category: 'Legal Rights', desc: 'Right to residence in shared household, protection orders, maintenance.' },
    { title: 'Maternity Benefit Act 2017', section: '#rights', category: 'Employment', desc: '26 weeks fully paid maternity leave and crèche access.' },
    { title: 'Equal Coparcenary Property Rights', section: '#rights', category: 'Property Rights', desc: 'Daughters hold unconditional birth rights in ancestral property.' },
    { title: 'NALSA Free Legal Aid for Women', section: '#rights', category: 'Legal Aid', desc: 'Section 12(c): Free government lawyer & court fees for all women.' },
    { title: 'Beti Bachao Beti Padhao & SSY', section: '#opportunities', category: 'Govt Schemes', desc: 'High interest 8.2% Sukanya Samriddhi savings scheme.' },
    { title: 'Stand-Up India Scheme', section: '#opportunities', category: 'Govt Loans', desc: 'Loans from ₹10 Lakhs to ₹1 Crore for women entrepreneurs.' },
    { title: 'Pradhan Mantri Matru Vandana Yojana (PMMVY)', section: '#opportunities', category: 'Maternal Support', desc: '₹5,000 cash incentive DBT into mother\'s bank account.' },
    { title: 'PRAGATI Scholarship for Girls', section: '#opportunities', category: 'Scholarships', desc: '₹50,000 per year for technical degree students by AICTE.' },
    { title: 'National Emergency 112', section: '#safety', category: 'Emergency Helplines', desc: 'Pan-India single number for police, ambulance and fire.' },
    { title: 'Women Police Helpline 1091', section: '#safety', category: 'Emergency Helplines', desc: 'Immediate police response cell for women in danger.' },
    { title: 'Women in Distress Helpline 181', section: '#safety', category: 'Emergency Helplines', desc: 'Toll-free counselling, shelter and dispute redressal.' },
    { title: 'Sakhi One-Stop Centres', section: '#safety', category: 'Support Centres', desc: 'Integrated medical, legal, and temporary shelter in 700+ districts.' }
  ];

  function openSearch() {
    searchOverlay.classList.add('active');
    searchOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => globalSearchInput && globalSearchInput.focus(), 150);
  }

  function closeSearch() {
    searchOverlay.classList.remove('active');
    searchOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (searchToggleBtn) searchToggleBtn.addEventListener('click', openSearch);
  if (searchCloseBtn) searchCloseBtn.addEventListener('click', closeSearch);

  // Keyboard shortcut Ctrl+K or /
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA')) {
      e.preventDefault();
      openSearch();
    }
    if (e.key === 'Escape' && searchOverlay.classList.contains('active')) {
      closeSearch();
    }
  });

  // Filter Search Results
  function performSearch(query) {
    if (!searchResultsBox) return;
    const cleanQuery = query.trim().toLowerCase();

    if (!cleanQuery) {
      searchResultsBox.innerHTML = '';
      return;
    }

    const matched = searchableData.filter(item => 
      item.title.toLowerCase().includes(cleanQuery) ||
      item.category.toLowerCase().includes(cleanQuery) ||
      item.desc.toLowerCase().includes(cleanQuery)
    );

    if (matched.length === 0) {
      searchResultsBox.innerHTML = `
        <div style="padding: 1.5rem; text-align: center; color: var(--c-plum-muted);">
          <i class="fa-solid fa-magnifying-glass" style="font-size: 1.5rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
          <p>No guides or schemes found for "${query}". Try searching "POSH", "Loan", or "112".</p>
        </div>
      `;
      return;
    }

    searchResultsBox.innerHTML = matched.map(item => `
      <div class="search-result-item" data-target="${item.section}">
        <div>
          <h5>${item.title}</h5>
          <p>${item.desc}</p>
        </div>
        <span class="tag-category" style="font-size: 0.7rem;">${item.category}</span>
      </div>
    `).join('');

    // Attach click listeners to search result items
    searchResultsBox.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const target = el.getAttribute('data-target');
        closeSearch();
        const targetEl = document.querySelector(target);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', (e) => {
      performSearch(e.target.value);
    });
  }

  queryChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.getAttribute('data-query');
      if (globalSearchInput) {
        globalSearchInput.value = q;
        performSearch(q);
      }
    });
  });

  // =========================================================================
  // 7. RIGHTS FILTER TABS & DETAIL MODAL DATA
  // =========================================================================
  const filterBtns = document.querySelectorAll('#rightsFilterGroup .filter-btn');
  const rightsCards = document.querySelectorAll('.rights-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.getAttribute('data-filter');
      rightsCards.forEach(card => {
        const cat = card.getAttribute('data-category');
        if (filter === 'all' || cat === filter) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // Detailed Modal Guides for Rights
  const rightsDetailsData = {
    poshModal: {
      title: 'POSH Act 2013: Workplace Protection & Grievance Mechanism',
      icon: 'fa-briefcase',
      content: `
        <div class="modal-guide-content">
          <p class="section-lead">The <strong>Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013</strong> ensures safe, dignified working conditions for every working woman across organized and unorganized sectors.</p>
          
          <h4 style="color: var(--c-deep-plum); margin: 1.25rem 0 0.5rem;"><i class="fa-solid fa-list-check" style="color: var(--c-soft-purple);"></i> Who is Protected?</h4>
          <p>Any woman employee—regular, temporary, ad-hoc, daily wage, intern, volunteer, or visitor—in offices, hospitals, schools, sports stadiums, dwelling places, and transit transportation.</p>

          <h4 style="color: var(--c-deep-plum); margin: 1.25rem 0 0.5rem;"><i class="fa-solid fa-file-signature" style="color: var(--c-soft-purple);"></i> How to File a Complaint:</h4>
          <ol style="padding-left: 1.25rem; font-size: 0.92rem; line-height: 1.7; color: var(--c-text-body);">
            <li><strong>Written Complaint:</strong> Submit a complaint in writing to your organisation's Internal Committee (IC) within 3 months of the incident.</li>
            <li><strong>Conciliation Option:</strong> You can request conciliation (monetary settlement is strictly barred).</li>
            <li><strong>90-Day Inquiry:</strong> The IC must conduct an inquiry following natural justice and submit findings within 90 days.</li>
            <li><strong>Interim Relief:</strong> You may request paid leave for up to 3 months or a transfer to a different team during the inquiry.</li>
          </ol>

          <div style="background: var(--c-soft-lavender); padding: 1rem; border-radius: var(--radius-md); margin-top: 1.5rem; font-size: 0.85rem;">
            <strong>No IC in your organisation?</strong> If the employer has fewer than 10 workers or the complaint is against the employer, approach your district's <em>Local Complaints Committee (LCC)</em> at the District Magistrate office.
          </div>
        </div>
      `
    },
    zeroFirModal: {
      title: 'Right to Zero FIR & Police Protections for Women',
      icon: 'fa-shield-halved',
      content: `
        <div class="modal-guide-content">
          <p class="section-lead">A <strong>Zero FIR</strong> allows any woman victim of a cognizable offence to lodge an FIR at <em>any</em> police station, even outside the jurisdictional area where the incident took place.</p>
          
          <h4 style="color: var(--c-deep-plum); margin: 1.25rem 0 0.5rem;"><i class="fa-solid fa-gavel" style="color: var(--c-soft-purple);"></i> Key Legal Protections:</h4>
          <ul style="padding-left: 1.25rem; font-size: 0.92rem; line-height: 1.7; color: var(--c-text-body);">
            <li><strong>Duty to Register:</strong> Police officers who refuse to register an FIR for offences against women can be penalized with imprisonment under Section 166A of the Indian Penal Code.</li>
            <li><strong>Right to Virtual / Email Filing:</strong> A woman can send her written complaint via registered post or certified email to a senior police superintendent if unable to reach a station.</li>
            <li><strong>No Station Summons After Sunset:</strong> Section 160 CrPC guarantees that women and children cannot be summoned to police stations for questioning between sunset and sunrise. Examination must occur at their residence with a female officer or guardian present.</li>
          </ul>
        </div>
      `
    },
    domesticViolenceModal: {
      title: 'Protection of Women from Domestic Violence Act (PWDVA, 2005)',
      icon: 'fa-people-roof',
      content: `
        <div class="modal-guide-content">
          <p class="section-lead">The PWDVA 2005 is a progressive civil law designed to provide fast, effective legal remedies to women facing violence within the domestic sphere.</p>
          
          <h4 style="color: var(--c-deep-plum); margin: 1.25rem 0 0.5rem;"><i class="fa-solid fa-shapes" style="color: var(--c-soft-purple);"></i> What Constitutes Domestic Violence?</h4>
          <p style="font-size: 0.92rem; color: var(--c-text-body); line-height: 1.6;">It encompasses physical injury, sexual abuse, emotional & verbal insults, dowry demands, and <em>economic abuse</em> (depriving food, clothing, money, or access to family finances).</p>

          <h4 style="color: var(--c-deep-plum); margin: 1.25rem 0 0.5rem;"><i class="fa-solid fa-umbrella" style="color: var(--c-soft-purple);"></i> Remedies Granted by Court:</h4>
          <ul style="padding-left: 1.25rem; font-size: 0.92rem; line-height: 1.7; color: var(--c-text-body);">
            <li><strong>Right to Reside:</strong> You cannot be thrown out or locked out of the shared household.</li>
            <li><strong>Protection Orders:</strong> Prohibiting the respondent from committing further acts or entering your workplace/college.</li>
            <li><strong>Monetary Maintenance:</strong> Monthly expenses for you and your children, plus emergency medical bill reimbursements.</li>
          </ul>
        </div>
      `
    },
    maternityModal: {
      title: 'Maternity Benefit Act: 26 Weeks Paid Leave & Crèche Entitlement',
      icon: 'fa-baby-carriage',
      content: `
        <div class="modal-guide-content">
          <p class="section-lead">The Maternity Benefit (Amendment) Act 2017 protects women's maternal health and job security during pregnancy and childbirth.</p>
          
          <h4 style="color: var(--c-deep-plum); margin: 1.25rem 0 0.5rem;"><i class="fa-solid fa-check-double" style="color: var(--c-soft-purple);"></i> Key Provisions:</h4>
          <ul style="padding-left: 1.25rem; font-size: 0.92rem; line-height: 1.7; color: var(--c-text-body);">
            <li><strong>Duration:</strong> 26 weeks paid leave for the first two surviving children (up to 8 weeks before delivery, and the remainder afterwards).</li>
            <li><strong>Adoption & Surrogacy:</strong> 12 weeks of paid leave for commissioning and adoptive mothers.</li>
            <li><strong>Crèche Facility:</strong> Mandatory crèche in establishments with 50+ employees; mothers are permitted 4 visits a day.</li>
            <li><strong>Protection Against Termination:</strong> It is unlawful for an employer to discharge or dismiss a woman during maternity leave.</li>
          </ul>
        </div>
      `
    },
    propertyModal: {
      title: 'Equal Coparcenary & Stridhan Property Rights',
      icon: 'fa-landmark',
      content: `
        <div class="modal-guide-content">
          <p class="section-lead">In August 2020 (Vineeta Sharma v. Rakesh Sharma), the Supreme Court affirmed that a daughter has unconditional, equal coparcenary rights by birth under the Hindu Succession Act.</p>
          
          <h4 style="color: var(--c-deep-plum); margin: 1.25rem 0 0.5rem;"><i class="fa-solid fa-coins" style="color: var(--c-soft-purple);"></i> Key Distinctions:</h4>
          <ul style="padding-left: 1.25rem; font-size: 0.92rem; line-height: 1.7; color: var(--c-text-body);">
            <li><strong>Equal Share in Ancestral Property:</strong> Daughters have the same partition rights and liabilities as sons, irrespective of whether the father passed away before or after 2005.</li>
            <li><strong>Absolute Right to Stridhan:</strong> Gifts, jewelry, cash, and assets given to a woman before, at, or after marriage remain her absolute personal property. In-laws or spouses have zero legal claim over it.</li>
          </ul>
        </div>
      `
    },
    nalsaModal: {
      title: 'Right to Free Legal Services (NALSA & State Authorities)',
      icon: 'fa-scale-balanced',
      content: `
        <div class="modal-guide-content">
          <p class="section-lead">Under Section 12(c) of the Legal Services Authorities Act, 1987, <strong>every Indian woman</strong>—regardless of her personal income—is entitled to free legal aid in civil, criminal, and family court proceedings.</p>
          
          <h4 style="color: var(--c-deep-plum); margin: 1.25rem 0 0.5rem;"><i class="fa-solid fa-hand-holding-dollar" style="color: var(--c-soft-purple);"></i> What is Covered for Free?</h4>
          <ul style="padding-left: 1.25rem; font-size: 0.92rem; line-height: 1.7; color: var(--c-text-body);">
            <li>Appointment of qualified advocates paid by the government.</li>
            <li>Payment of court fees, drafting charges, and process expenses.</li>
            <li>Preparation of appeals, certified paper books, and Supreme Court filings.</li>
          </ul>
          <p style="margin-top: 1rem; font-size: 0.88rem; color: var(--c-plum-muted);">
            To apply, visit the Taluk Legal Services Committee or District Legal Services Authority (DLSA) at your district court complex or dial <strong>15100</strong> (NALSA National Helpline).
          </p>
        </div>
      `
    }
  };

  const rightsDetailModal = document.getElementById('rightsDetailModal');
  const rightModalTitle = document.getElementById('rightModalTitle');
  const rightModalBody = document.getElementById('rightModalBody');
  const rightModalIcon = document.getElementById('rightModalIcon');

  document.querySelectorAll('.rights-details-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalKey = btn.getAttribute('data-modal');
      const data = rightsDetailsData[modalKey];
      if (data && rightsDetailModal) {
        rightModalTitle.textContent = data.title;
        rightModalIcon.className = `fa-solid ${data.icon}`;
        rightModalBody.innerHTML = data.content;
        openModal(rightsDetailModal);
      }
    });
  });

  // =========================================================================
  // 8. SCHEMES INTERACTIVE ELIGIBILITY MODAL
  // =========================================================================
  const schemeData = {
    bbbp: {
      title: 'Beti Bachao Beti Padhao & Sukanya Samriddhi Yojana (SSY)',
      icon: 'fa-child-dress',
      content: `
        <div class="modal-guide-content">
          <p class="section-lead">A collaborative campaign by the Ministry of Women and Child Development, Health, and HRD to eliminate sex-selective practices and promote higher education for girls.</p>
          <h4 style="color: var(--c-deep-plum); margin: 1rem 0 0.5rem;">Sukanya Samriddhi Account Highlights:</h4>
          <ul style="padding-left: 1.25rem; font-size: 0.92rem; line-height: 1.7;">
            <li><strong>Interest Rate:</strong> 8.2% p.a. (compounded annually, fully tax-free under 80C).</li>
            <li><strong>Deposit Limits:</strong> Minimum ₹250, Maximum ₹1,50,000 per financial year.</li>
            <li><strong>Maturity:</strong> 21 years from account opening, or upon marriage of the girl child after age 18.</li>
            <li><strong>Where to open:</strong> Any designated Post Office or authorized commercial bank branch.</li>
          </ul>
        </div>
      `
    },
    standup: {
      title: 'Stand-Up India: Entrepreneurship Loans for Women',
      icon: 'fa-building-columns',
      content: `
        <div class="modal-guide-content">
          <p class="section-lead">Empowers women entrepreneurs to set up greenfield enterprises in manufacturing, services, or agri-allied trading sectors.</p>
          <h4 style="color: var(--c-deep-plum); margin: 1rem 0 0.5rem;">Eligibility & Loan Criteria:</h4>
          <ul style="padding-left: 1.25rem; font-size: 0.92rem; line-height: 1.7;">
            <li><strong>Borrower:</strong> Women above 18 years of age.</li>
            <li><strong>Loan Quantum:</strong> ₹10,00,000 to ₹1,00,00,000 (composite loan).</li>
            <li><strong>Security:</strong> Collateral or Credit Guarantee Scheme for Stand-Up India (CGSSI).</li>
            <li><strong>Repayment:</strong> Up to 7 years with a moratorium period up to 18 months.</li>
            <li><strong>How to apply:</strong> Online at standupmitra.in or directly at any scheduled commercial bank branch.</li>
          </ul>
        </div>
      `
    },
    pmmvy: {
      title: 'Pradhan Mantri Matru Vandana Yojana (PMMVY)',
      icon: 'fa-person-breastfeeding',
      content: `
        <div class="modal-guide-content">
          <p class="section-lead">Direct Benefit Transfer (DBT) scheme compensating wage loss during pregnancy and ensuring institutional child nutrition.</p>
          <h4 style="color: var(--c-deep-plum); margin: 1rem 0 0.5rem;">Benefit Structure:</h4>
          <ul style="padding-left: 1.25rem; font-size: 0.92rem; line-height: 1.7;">
            <li><strong>First Child:</strong> ₹5,000 in two instalments linked to antenatal checkup (ANC) and child immunization.</li>
            <li><strong>Second Girl Child:</strong> ₹6,000 in a single instalment to encourage the birth of daughters.</li>
            <li><strong>Application:</strong> Submit MCP card and bank passbook at your local Anganwadi Centre or PMMVY portal.</li>
          </ul>
        </div>
      `
    },
    udyam: {
      title: 'Udyam Sakhi & Mahila Co-op Enterprise Portal',
      icon: 'fa-shop',
      content: `
        <div class="modal-guide-content">
          <p class="section-lead">Initiative under the Ministry of MSME to nurture female entrepreneurs, Self-Help Groups (SHGs), and craft collectives.</p>
          <h4 style="color: var(--c-deep-plum); margin: 1rem 0 0.5rem;">Services Provided:</h4>
          <ul style="padding-left: 1.25rem; font-size: 0.92rem; line-height: 1.7;">
            <li>Assistance with business planning, project reports, and MSME Udyam certificate registration.</li>
            <li>Subsidized collateral-free loans under CGTMSE and Prime Minister's Employment Generation Programme (PMEGP).</li>
            <li>Fair trade exhibition access and e-marketplace linkages.</li>
          </ul>
        </div>
      `
    }
  };

  document.querySelectorAll('[data-scheme]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-scheme');
      const data = schemeData[key];
      if (data && rightsDetailModal) {
        rightModalTitle.textContent = data.title;
        rightModalIcon.className = `fa-solid ${data.icon}`;
        rightModalBody.innerHTML = data.content;
        openModal(rightsDetailModal);
      }
    });
  });

  // =========================================================================
  // 9. SAKHI ONE-STOP CENTRE STATE DIRECTORY SIMULATOR
  // =========================================================================
  const stateSelect = document.getElementById('stateSelect');
  const oscResult = document.getElementById('oscResult');

  const oscDirectory = {
    delhi: {
      centres: '11 Active Sakhi Centres (Covering North, South, Central & West Districts)',
      nodal: 'State Women Helpline: 181 / (011) 23378044',
      address: 'Major hub: Ambedkar Hospital & GTB Hospital Sakhi Units.'
    },
    maharashtra: {
      centres: '36 Sakhi One Stop Centres across all district hospitals',
      nodal: 'State Women Commission: 7477722244 / 181',
      address: 'Mumbai Central OSC: KEM Hospital Campus, Parel.'
    },
    karnataka: {
      centres: '30 District Centres in affiliation with Dept of Women & Child Development',
      nodal: 'Parihar Police Family Counselling Helpline: (080) 22943225 / 1091',
      address: 'Bengaluru OSC: Bowring and Lady Curzon Hospital premises.'
    },
    tamilnadu: {
      centres: '32 Integrated Centres operating 24x7 with medical, legal, and counsellor staff',
      nodal: 'State Helpline: 181 / Chennai City Police Wing: 044-23452365',
      address: 'Chennai OSC: Institute of Obstetrics & Gynaecology, Egmore.'
    },
    up: {
      centres: '75 One Stop Centres active in every district headquarter',
      nodal: 'UP 1090 Women Power Line / 181',
      address: 'Lucknow OSC: Dr. Ram Manohar Lohia Combined Hospital.'
    },
    bengal: {
      centres: '23 District One Stop Centres managed by WCD and Social Welfare',
      nodal: 'Kolkata Police Women Helpline: 1091 / 033-22145000',
      address: 'Kolkata OSC: Chittaranjan National Medical College Hospital.'
    },
    telangana: {
      centres: '33 Centres in collaboration with Women Development & Child Welfare Dept',
      nodal: 'Bharosa Centre & 181 Helpline: 040-27852444',
      address: 'Hyderabad OSC: Bharosa Society, Old Commissionerate Building, Purani Haveli.'
    },
    gujarat: {
      centres: '33 Sakhi Centres established across all municipal and civil hospitals',
      nodal: '181 Abhayam Women Helpline (24x7 GPS vehicle support)',
      address: 'Ahmedabad OSC: Ahmedabad Civil Hospital Complex, Asarwa.'
    }
  };

  const stateCodeMap = {
    delhi: 'DL',
    maharashtra: 'MH',
    karnataka: 'KA',
    tamilnadu: 'TN',
    up: 'UP',
    bengal: 'WB',
    telangana: 'TG',
    gujarat: 'GJ'
  };

  if (stateSelect && oscResult) {
    stateSelect.addEventListener('change', async (e) => {
      const val = e.target.value;
      if (!val) {
        oscResult.style.display = 'none';
        return;
      }

      // Check if Supabase live backend is connected
      if (window.AyraBackend && window.AyraBackend.isConfigured()) {
        const stateCode = stateCodeMap[val] || val.toUpperCase();
        const liveCentres = await window.AyraBackend.getSakhiCentres(stateCode);
        if (liveCentres && liveCentres.length > 0) {
          oscResult.style.display = 'block';
          oscResult.innerHTML = `
            <div style="font-weight: 700; color: var(--c-deep-plum); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem;">
              <i class="fa-solid fa-shield-halved" style="color: #1B7A53;"></i> Verified Sakhi Centre (${liveCentres[0].state_name})
            </div>
            ${liveCentres.map(c => `
              <div class="sakhi-live-result-item" style="background:#FFFFFF; border:1px solid var(--c-card-border-alt); border-radius:var(--radius-sm); padding:0.85rem; margin-bottom:0.5rem;">
                <div style="font-weight:600; color:var(--c-deep-plum); margin-bottom:0.25rem;">${c.centre_name} (${c.district})</div>
                <div style="font-size:0.88rem; margin-bottom:0.25rem;"><i class="fa-solid fa-phone" style="color:var(--c-soft-purple);"></i> <strong>Helpline:</strong> <a href="tel:${c.helpline_phone.replace(/[^0-9]/g, '')}" style="color:var(--c-deep-plum); font-weight:700; text-decoration:underline;">${c.helpline_phone}</a></div>
                <div style="font-size:0.84rem; color:var(--c-plum-muted); margin-bottom:0.25rem;"><i class="fa-solid fa-location-dot"></i> ${c.address}</div>
                ${c.nodal_officer ? `<div style="font-size:0.82rem; color:var(--c-text-body);"><i class="fa-solid fa-user-tie"></i> <strong>Officer:</strong> ${c.nodal_officer}</div>` : ''}
              </div>
            `).join('')}
          `;
          return;
        }
      }

      // Fallback local dictionary
      if (oscDirectory[val]) {
        const d = oscDirectory[val];
        oscResult.style.display = 'block';
        oscResult.innerHTML = `
          <div style="font-weight: 700; color: var(--c-deep-plum); margin-bottom: 0.35rem;">
            <i class="fa-solid fa-location-dot" style="color: #1B7A53;"></i> Sakhi Directory for Selected State:
          </div>
          <div style="margin-bottom: 0.3rem;"><strong>Coverage:</strong> ${d.centres}</div>
          <div style="margin-bottom: 0.3rem;"><strong>Nodal Contact:</strong> ${d.nodal}</div>
          <div><strong>Key Facility:</strong> ${d.address}</div>
        `;
      } else {
        oscResult.style.display = 'none';
      }
    });
  }

  // =========================================================================
  // 10. VOICE ASSISTANT INTERACTIVE SCREEN & PROMPTS
  // =========================================================================
  const assistantBubble = document.getElementById('assistantBubble');
  const voiceCustomInput = document.getElementById('voiceCustomInput');
  const btnVoiceSend = document.getElementById('btnVoiceSend');
  const btnMicTrigger = document.getElementById('btnMicTrigger');
  const voicePromptChips = document.querySelectorAll('.voice-prompt-chip');

  function handleVoiceQuery(question, answerEn, answerHi) {
    const isHindi = voiceLangSelect && voiceLangSelect.value.startsWith('hi');
    const answer = isHindi && answerHi ? answerHi : (answerEn || `Here is the verified information regarding "${question}". AYRA provides verified legal and safety assistance across India.`);
    
    if (assistantBubble) {
      assistantBubble.textContent = answer;
    }

    const langCode = isHindi ? 'hi-IN' : 'en-IN';
    speakText(answer, langCode);
  }

  voicePromptChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.textContent.trim().replace(/^"|"$/g, '');
      const ansEn = chip.getAttribute('data-answer-en');
      const ansHi = chip.getAttribute('data-answer-hi');
      handleVoiceQuery(q, ansEn, ansHi);
    });
  });

  if (btnVoiceSend && voiceCustomInput) {
    btnVoiceSend.addEventListener('click', () => {
      const q = voiceCustomInput.value.trim();
      if (!q) return;

      // Smart responses to typed queries
      let ans = `Thank you for asking about "${q}". Under Indian law, you are entitled to constitutional equality, legal aid, and safety protections. Check our Rights and Opportunities sections for specific guidelines.`;
      
      const qLower = q.toLowerCase();
      if (qLower.includes('maternity') || qLower.includes('pregnant')) {
        ans = "The Maternity Benefit Act grants 26 weeks of paid leave for working women. Dismissal during maternity is strictly prohibited.";
      } else if (qLower.includes('harass') || qLower.includes('posh') || qLower.includes('office')) {
        ans = "The POSH Act protects against workplace harassment. Every firm with 10+ employees must have an Internal Committee.";
      } else if (qLower.includes('fir') || qLower.includes('police')) {
        ans = "You have the right to file a Zero FIR at any police station across India regardless of jurisdiction.";
      } else if (qLower.includes('emergency') || qLower.includes('help') || qLower.includes('number')) {
        ans = "In an emergency dial 112 for police and medical assistance, or 1091 for the Women Helpline.";
      } else if (qLower.includes('scholarship') || qLower.includes('college')) {
        ans = "The AICTE Pragati Scholarship offers 50,000 rupees per year for girls pursuing engineering and technical degrees.";
      }

      if (assistantBubble) assistantBubble.textContent = ans;
      speakText(ans, 'en-IN');
      voiceCustomInput.value = '';
    });

    voiceCustomInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') btnVoiceSend.click();
    });
  }

  // Microphone Speech Recognition
  if (btnMicTrigger) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    let recognition = null;

    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        btnMicTrigger.classList.add('listening');
        showToast('Listening to your voice...', 'info', 'fa-microphone');
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (voiceCustomInput) voiceCustomInput.value = transcript;
        if (btnVoiceSend) btnVoiceSend.click();
      };

      recognition.onend = () => {
        btnMicTrigger.classList.remove('listening');
      };

      recognition.onerror = () => {
        btnMicTrigger.classList.remove('listening');
        showToast('Could not recognize voice. Please type your query.', 'warning');
      };

      btnMicTrigger.addEventListener('click', () => {
        if (btnMicTrigger.classList.contains('listening')) {
          recognition.stop();
        } else {
          const selectedLang = voiceLangSelect ? voiceLangSelect.value : 'en-IN';
          recognition.lang = selectedLang;
          recognition.start();
        }
      });
    } else {
      btnMicTrigger.addEventListener('click', () => {
        showToast('Voice input is simulated on this browser. Please type your question.', 'info');
        if (voiceCustomInput) voiceCustomInput.focus();
      });
    }
  }

  // =========================================================================
  // 11. WORKSHOP REGISTRATION DEMO
  // =========================================================================
  const workshopModal = document.getElementById('workshopModal');
  const wModalTitle = document.getElementById('wModalTitle');
  const wModalDate = document.getElementById('wModalDate');
  const workshopForm = document.getElementById('workshopForm');
  const workshopSuccessCard = document.getElementById('workshopSuccessCard');
  const successName = document.getElementById('successName');
  const successDetails = document.getElementById('successDetails');

  let selectedWorkshopSlug = 'financial-autonomy-sips';

  document.querySelectorAll('.btn-register-workshop').forEach(btn => {
    btn.addEventListener('click', () => {
      const title = btn.getAttribute('data-title');
      const date = btn.getAttribute('data-date');
      const slug = btn.getAttribute('data-slug') || 'financial-autonomy-sips';
      selectedWorkshopSlug = slug;

      if (wModalTitle) wModalTitle.textContent = title;
      if (wModalDate) wModalDate.textContent = date;

      if (workshopForm) workshopForm.style.display = 'block';
      if (workshopSuccessCard) workshopSuccessCard.style.display = 'none';

      // Auto-populate from logged in user if available
      if (currentUserProfile) {
        const wName = document.getElementById('wName');
        const wEmail = document.getElementById('wEmail');
        const wPhone = document.getElementById('wPhone');
        const wCity = document.getElementById('wCity');
        if (wName && currentUserProfile.full_name) wName.value = currentUserProfile.full_name;
        if (wEmail && currentUserProfile.email) wEmail.value = currentUserProfile.email;
        if (wPhone && currentUserProfile.phone) wPhone.value = currentUserProfile.phone;
        if (wCity && currentUserProfile.city) wCity.value = currentUserProfile.city;
      }

      openModal(workshopModal);
    });
  });

  if (workshopForm) {
    workshopForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('wName').value.trim();
      const email = document.getElementById('wEmail').value.trim();
      const phone = document.getElementById('wPhone').value.trim();
      const city = document.getElementById('wCity').value.trim();

      if (!name || !email || !city || !phone) {
        showToast('Please fill in all required registration fields.', 'warning');
        return;
      }

      let generatedCode = 'AYRA-PASS-2026';

      // Check if Supabase live backend is connected
      if (window.AyraBackend && window.AyraBackend.isConfigured()) {
        showToast('Registering with live database...', 'info', 'fa-database');
        const res = await window.AyraBackend.registerWorkshop({
          name,
          email,
          phone,
          city,
          workshopId: selectedWorkshopSlug
        });
        if (res.success && res.ticketCode) {
          generatedCode = res.ticketCode;
        }
      }

      workshopForm.style.display = 'none';
      if (workshopSuccessCard) {
        workshopSuccessCard.style.display = 'block';
        if (successName) successName.textContent = name;
        const ticketCodeEl = workshopSuccessCard.querySelector('.ticket-code');
        if (ticketCodeEl) ticketCodeEl.textContent = generatedCode;
        if (successDetails) {
          successDetails.textContent = `${wModalTitle.textContent} (${wModalDate.textContent}) • City: ${city}`;
        }
      }

      const modeNote = window.AyraBackend && window.AyraBackend.isConfigured() ? 'Live Confirmed' : 'Demo Pass';
      showToast(`Workshop registered for ${name}! (${modeNote})`, 'success', 'fa-circle-check');

      // Refresh workshop data and user dashboard passes in the background
      loadLiveWorkshops();
    });
  }

  // Load live workshops data and update available seats from Supabase
  async function loadLiveWorkshops() {
    if (!window.AyraBackend || !window.AyraBackend.isConfigured()) return;
    try {
      const workshops = await window.AyraBackend.getWorkshops();
      if (!workshops || !Array.isArray(workshops)) return;

      workshops.forEach(w => {
        const btn = document.querySelector(`.btn-register-workshop[data-slug="${w.slug}"]`);
        if (!btn) return;
        const card = btn.closest('.workshop-card');
        if (!card) return;

        const seatsLeft = Math.max(0, (w.total_seats || 100) - (w.seats_booked || 0));
        const seatsEl = card.querySelector('.w-seats');
        if (seatsEl) {
          seatsEl.innerHTML = `<i class="fa-solid fa-user-group"></i> ${seatsLeft} Seats Left`;
          if (seatsLeft === 0) {
            seatsEl.style.color = '#DC2626';
            btn.disabled = true;
            btn.textContent = 'Fully Booked';
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
          }
        }
      });
    } catch (err) {
      console.warn('[AYRA] Failed to fetch live workshops:', err);
    }
  }

  // Initial fetch for workshops
  loadLiveWorkshops();

  // Peer Circle button
  const btnJoinCircle = document.getElementById('btnJoinCircle');
  if (btnJoinCircle) {
    btnJoinCircle.addEventListener('click', () => {
      showToast('AYRA Peer Circles registration portal opens next week. Stay tuned!', 'info', 'fa-users');
    });
  }

  // =========================================================================
  // 12. MARKETPLACE CART DEMO
  // =========================================================================
  const cartToggleBtn = document.getElementById('cartToggleBtn');
  const cartDrawer = document.getElementById('cartDrawer');
  const cartCloseBtn = document.getElementById('cartCloseBtn');
  const cartBackdrop = document.getElementById('cartBackdrop');
  const cartCount = document.getElementById('cartCount');
  const cartItemsList = document.getElementById('cartItemsList');
  const cartSubtotal = document.getElementById('cartSubtotal');
  const emptyCartState = document.getElementById('emptyCartState');
  const btnCheckoutDemo = document.getElementById('btnCheckoutDemo');
  const btnBrowseMarketplace = document.getElementById('btnBrowseMarketplace');

  function openCart() {
    cartDrawer.classList.add('active');
    cartBackdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeCart() {
    cartDrawer.classList.remove('active');
    cartBackdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (cartToggleBtn) cartToggleBtn.addEventListener('click', openCart);
  if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCart);
  if (cartBackdrop) cartBackdrop.addEventListener('click', closeCart);
  if (btnBrowseMarketplace) btnBrowseMarketplace.addEventListener('click', closeCart);

  function renderCart() {
    const totalCount = state.cart.reduce((sum, item) => sum + item.qty, 0);
    if (cartCount) cartCount.textContent = totalCount;

    if (state.cart.length === 0) {
      if (emptyCartState) emptyCartState.style.display = 'block';
      if (cartItemsList) {
        cartItemsList.innerHTML = '';
        cartItemsList.appendChild(emptyCartState);
      }
      if (cartSubtotal) cartSubtotal.textContent = '₹0';
      return;
    }

    if (emptyCartState) emptyCartState.style.display = 'none';

    let total = 0;
    const itemsHtml = state.cart.map(item => {
      total += item.price * item.qty;
      return `
        <div class="cart-item-row" data-id="${item.id}">
          <div class="cart-item-info">
            <h5>${item.name}</h5>
            <span>₹${item.price.toLocaleString('en-IN')} × ${item.qty} = <strong>₹${(item.price * item.qty).toLocaleString('en-IN')}</strong></span>
          </div>
          <div class="cart-item-qty">
            <button type="button" class="qty-btn btn-qty-dec" data-id="${item.id}" aria-label="Decrease quantity">-</button>
            <span>${item.qty}</span>
            <button type="button" class="qty-btn btn-qty-inc" data-id="${item.id}" aria-label="Increase quantity">+</button>
          </div>
        </div>
      `;
    }).join('');

    if (cartItemsList) cartItemsList.innerHTML = itemsHtml;
    if (cartSubtotal) cartSubtotal.textContent = `₹${total.toLocaleString('en-IN')}`;

    // Attach quantity event listeners
    cartItemsList.querySelectorAll('.btn-qty-inc').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-id');
        const item = state.cart.find(i => i.id === id);
        if (item) item.qty += 1;
        renderCart();
      });
    });

    cartItemsList.querySelectorAll('.btn-qty-dec').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-id');
        const item = state.cart.find(i => i.id === id);
        if (item) {
          item.qty -= 1;
          if (item.qty <= 0) {
            state.cart = state.cart.filter(i => i.id !== id);
          }
        }
        renderCart();
      });
    });
  }

  // Add to cart buttons
  document.querySelectorAll('.btn-add-cart').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.product-card');
      if (!card) return;
      const id = card.getAttribute('data-id');
      const name = card.getAttribute('data-name');
      const price = parseInt(card.getAttribute('data-price'), 10) || 0;

      const existing = state.cart.find(i => i.id === id);
      if (existing) {
        existing.qty += 1;
      } else {
        state.cart.push({ id, name, price, qty: 1 });
      }

      renderCart();
      showToast(`Added "${name}" to your basket!`, 'success', 'fa-basket-shopping');
    });
  });

  if (btnCheckoutDemo) {
    btnCheckoutDemo.addEventListener('click', () => {
      if (state.cart.length === 0) {
        showToast('Your basket is currently empty.', 'warning');
        return;
      }
      closeCart();
      showToast('Demonstration Mode: No payment processed. Thank you for previewing AYRA CARE!', 'info', 'fa-lock');
    });
  }

  // =========================================================================
  // 13. MODALS GENERIC HANDLER & GET SUPPORT MODAL
  // =========================================================================
  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('active');
    modalEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('active');
    modalEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Close modal via close button or backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });

    const closeBtn = modal.querySelector('.modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => closeModal(modal));
    }
  });

  // Get Support Button in Header
  const getSupportBtn = document.getElementById('getSupportBtn');
  const supportModal = document.getElementById('supportModal');
  if (getSupportBtn && supportModal) {
    getSupportBtn.addEventListener('click', () => {
      openModal(supportModal);
    });
  }

  // =========================================================================
  // 14. CONTACT FORM VALIDATION & SUBMISSION
  // =========================================================================
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('contactName').value.trim();
      const email = document.getElementById('contactEmail').value.trim();
      const phoneInput = document.getElementById('contactPhone');
      const phone = phoneInput ? phoneInput.value.trim() : '';
      const subject = document.getElementById('contactSubject').value;
      const message = document.getElementById('contactMessage').value.trim();

      if (!name || !email || !subject || !message) {
        showToast('Please fill in all required fields.', 'warning', 'fa-circle-exclamation');
        return;
      }

      // Check if Supabase live backend is connected
      if (window.AyraBackend && window.AyraBackend.isConfigured()) {
        showToast('Submitting confidentially to database...', 'info', 'fa-database');
        const res = await window.AyraBackend.submitContactInquiry({
          name,
          email,
          phone,
          subject,
          message
        });

        if (res.success) {
          showToast(`Thank you, ${name}! Your inquiry has been securely saved to the database.`, 'success', 'fa-paper-plane');
          contactForm.reset();
        } else {
          showToast(`Error submitting: ${res.error || 'Please try again.'}`, 'warning', 'fa-circle-exclamation');
        }
      } else {
        // Fallback demo mode
        showToast(`Thank you, ${name}! Your inquiry has been received (Demo).`, 'success', 'fa-paper-plane');
        contactForm.reset();
      }
    });
  }

  // =========================================================================
  // 16. DATABASE STATUS BADGE & INTERACTIVE DIAGNOSTICS
  // =========================================================================
  const dbStatusBadge = document.getElementById('dbStatusBadge');
  const dbStatusLabel = document.getElementById('dbStatusLabel');

  async function checkDbConnection(showAlert = false) {
    if (!dbStatusBadge || !dbStatusLabel) return;

    if (!window.AyraBackend || !window.AyraBackend.isConfigured()) {
      dbStatusLabel.textContent = 'Database: Demo Mode';
      dbStatusBadge.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      dbStatusBadge.style.background = 'rgba(255, 255, 255, 0.12)';
      if (showAlert) {
        showToast('Running in Demo Mode. Enter your Supabase Project URL and anon key in supabase-client.js to connect.', 'info', 'fa-database');
      }
      return;
    }

    dbStatusLabel.textContent = 'Database: Testing...';
    const result = await window.AyraBackend.testConnection();

    if (result.success) {
      dbStatusLabel.innerHTML = '<span style="color: #4ADE80;">●</span> Supabase Live';
      dbStatusBadge.style.borderColor = 'rgba(74, 222, 128, 0.5)';
      dbStatusBadge.style.background = 'rgba(74, 222, 128, 0.15)';
      if (showAlert) {
        showToast('Connected to AYRA Supabase PostgreSQL database!', 'success', 'fa-circle-check');
      }
    } else {
      dbStatusLabel.innerHTML = '<span style="color: #F87171;">●</span> Connection Error';
      dbStatusBadge.style.borderColor = 'rgba(248, 113, 113, 0.5)';
      dbStatusBadge.style.background = 'rgba(248, 113, 113, 0.15)';
      if (showAlert) {
        showToast(`Supabase Error: ${result.message}`, 'warning', 'fa-triangle-exclamation');
      }
    }
  }

  // =========================================================================
  // 17. USER AUTHENTICATION & PROTECTED DASHBOARD MODULE
  // =========================================================================
  const authModal = document.getElementById('authModal');
  const dashboardModal = document.getElementById('dashboardModal');
  const headerAuthBtn = document.getElementById('headerAuthBtn');
  const drawerAuthBtn = document.getElementById('drawerAuthBtn');
  const authDropdownMenu = document.getElementById('authDropdownMenu');

  let currentAuthUser = null;
  let currentUserProfile = null;

  // Feedback Banner Helper
  function showAuthFeedback(message, type = 'error') {
    const banner = document.getElementById('authFeedbackBanner');
    if (!banner) return;
    banner.style.display = 'flex';
    banner.className = `auth-feedback-banner banner-${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    banner.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  }

  function clearAuthFeedback() {
    const banner = document.getElementById('authFeedbackBanner');
    if (banner) {
      banner.style.display = 'none';
      banner.innerHTML = '';
    }
  }

  // Switch Auth Tabs (Sign In / Sign Up / Forgot Password)
  function switchAuthTab(tabName) {
    clearAuthFeedback();
    const panels = ['signInTabPanel', 'signUpTabPanel', 'forgotPasswordTabPanel'];
    panels.forEach(id => {
      const panel = document.getElementById(id);
      if (panel) panel.classList.remove('active');
    });

    const tabButtons = [document.getElementById('tabBtnSignIn'), document.getElementById('tabBtnSignUp')];
    tabButtons.forEach(btn => btn && btn.classList.remove('active'));

    const modalIcon = document.getElementById('authModalHeaderIcon');
    const modalTitle = document.getElementById('authModalHeaderTitle');

    if (tabName === 'signIn') {
      document.getElementById('signInTabPanel')?.classList.add('active');
      document.getElementById('tabBtnSignIn')?.classList.add('active');
      if (modalIcon) modalIcon.className = 'fa-solid fa-lock';
      if (modalTitle) modalTitle.textContent = 'AYRA Member Access';
    } else if (tabName === 'signUp') {
      document.getElementById('signUpTabPanel')?.classList.add('active');
      document.getElementById('tabBtnSignUp')?.classList.add('active');
      if (modalIcon) modalIcon.className = 'fa-solid fa-user-plus';
      if (modalTitle) modalTitle.textContent = 'Create AYRA Account';
    } else if (tabName === 'forgot') {
      document.getElementById('forgotPasswordTabPanel')?.classList.add('active');
      if (modalIcon) modalIcon.className = 'fa-solid fa-key';
      if (modalTitle) modalTitle.textContent = 'Account Recovery';
    }
  }

  // Tab switch click handlers
  document.getElementById('tabBtnSignIn')?.addEventListener('click', () => switchAuthTab('signIn'));
  document.getElementById('tabBtnSignUp')?.addEventListener('click', () => switchAuthTab('signUp'));
  document.getElementById('btnShowForgotPassword')?.addEventListener('click', () => switchAuthTab('forgot'));
  document.getElementById('btnBackToSignIn')?.addEventListener('click', () => switchAuthTab('signIn'));

  // Password visibility toggle buttons
  document.querySelectorAll('.btn-toggle-pwd').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;
      const isPassword = input.getAttribute('type') === 'password';
      input.setAttribute('type', isPassword ? 'text' : 'password');
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = isPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
      }
    });
  });

  // Open Auth Modal
  function openAuthModal(defaultTab = 'signIn') {
    switchAuthTab(defaultTab);
    openModal(authModal);
  }

  // Auth Button Click Handler (Header)
  if (headerAuthBtn) {
    headerAuthBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentAuthUser) {
        authDropdownMenu?.classList.toggle('active');
      } else {
        openAuthModal('signIn');
      }
    });
  }

  // Mobile Drawer Auth Button
  if (drawerAuthBtn) {
    drawerAuthBtn.addEventListener('click', () => {
      closeDrawer();
      if (currentAuthUser) {
        openDashboardModal();
      } else {
        openAuthModal('signIn');
      }
    });
  }

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (authDropdownMenu && !authDropdownMenu.contains(e.target) && e.target !== headerAuthBtn) {
      authDropdownMenu.classList.remove('active');
    }
  });

  // Sign In Form Submission
  const signInForm = document.getElementById('signInForm');
  if (signInForm) {
    signInForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthFeedback();

      const email = document.getElementById('signInEmail').value.trim();
      const password = document.getElementById('signInPassword').value;
      const submitBtn = document.getElementById('signInSubmitBtn');

      if (!email || !password) {
        showAuthFeedback('Please enter both your email address and password.');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Signing in...</span>';
      }

      const res = await window.AyraBackend.signIn(email, password);

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> <span>Sign In Securely</span>';
      }

      if (res.success) {
        closeModal(authModal);
        signInForm.reset();
        await refreshAuthState();
        showToast(`Welcome back, ${currentUserProfile?.full_name || 'Sister'}!`, 'success', 'fa-circle-check');
      } else {
        showAuthFeedback(res.friendlyMessage || res.error || 'Invalid email or password. Please verify your credentials.');
      }
    });
  }

  // Sign Up Form Submission with Double-Submit & Rate-Limit Protection
  let isSignUpSubmitting = false;
  let signUpCooldownInterval = null;

  const signUpForm = document.getElementById('signUpForm');
  if (signUpForm) {
    signUpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isSignUpSubmitting) return;

      clearAuthFeedback();

      const fullName = document.getElementById('signUpFullName').value.trim();
      const email = document.getElementById('signUpEmail').value.trim();
      const password = document.getElementById('signUpPassword').value;
      const confirmPassword = document.getElementById('signUpConfirmPassword').value;
      const submitBtn = document.getElementById('signUpSubmitBtn');

      if (!fullName || !email || !password || !confirmPassword) {
        showAuthFeedback('Please fill out all required fields.');
        return;
      }

      if (password.length < 6) {
        showAuthFeedback('Password must be at least 6 characters in length.');
        return;
      }

      if (password !== confirmPassword) {
        showAuthFeedback('Passwords do not match. Please re-enter.');
        return;
      }

      isSignUpSubmitting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Creating account...</span>';
      }

      const res = await window.AyraBackend.signUp(email, password, fullName);

      if (res.success) {
        isSignUpSubmitting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-sparkles"></i> <span>Create AYRA Account</span>';
        }

        if (res.needsEmailConfirmation) {
          showAuthFeedback(`Account created successfully! We sent a confirmation link to ${email}. Please check your inbox to activate your account.`, 'success');
        } else {
          showAuthFeedback('Account created and verified successfully! Logging you in...', 'success');
          setTimeout(async () => {
            closeModal(authModal);
            signUpForm.reset();
            await refreshAuthState();
            showToast(`Welcome to AYRA, ${fullName}! Your account is active.`, 'success', 'fa-hand-holding-heart');
          }, 1200);
        }
      } else {
        if (res.alreadyRegistered) {
          const bannerMsg = `
            <div>
              <strong>Account Already Exists:</strong>
              <p style="margin: 0.35rem 0 0.5rem; font-size: 0.84rem; line-height: 1.4;">
                An account with this email is already registered. Please sign in with your password.
              </p>
              <button type="button" class="btn btn-secondary btn-sm" id="btnSwitchSignIn" style="padding: 0.25rem 0.65rem; font-size: 0.8rem;">
                <i class="fa-solid fa-right-to-bracket"></i> Switch to Sign In
              </button>
            </div>
          `;
          showAuthFeedback(bannerMsg, 'error');
          document.getElementById('btnSwitchSignIn')?.addEventListener('click', () => {
            switchAuthTab('signIn');
            const inEmail = document.getElementById('signInEmail');
            if (inEmail) inEmail.value = email;
          });
          isSignUpSubmitting = false;
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-sparkles"></i> <span>Create AYRA Account</span>';
          }
        } else if (res.isRateLimit) {
          // Provide friendly rate-limit message with switch-to-login shortcut
          const bannerMsg = `
            <div>
              <strong>Email Limit Reached:</strong>
              <p style="margin: 0.35rem 0 0.5rem; font-size: 0.84rem; line-height: 1.4;">
                ${res.friendlyMessage || 'Supabase default email service limits hourly verification emails to prevent spam.'}
              </p>
              <button type="button" class="btn btn-secondary btn-sm" id="btnRateLimitSignIn" style="padding: 0.25rem 0.65rem; font-size: 0.8rem;">
                <i class="fa-solid fa-right-to-bracket"></i> Try Signing In Instead
              </button>
            </div>
          `;
          showAuthFeedback(bannerMsg, 'error');

          document.getElementById('btnRateLimitSignIn')?.addEventListener('click', () => {
            switchAuthTab('signIn');
            const inEmail = document.getElementById('signInEmail');
            if (inEmail) inEmail.value = email;
          });

          // Prevent rapid re-submission with a 30-second cooldown
          let secondsLeft = 30;
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-regular fa-clock"></i> <span>Please wait ${secondsLeft}s...</span>`;
          }

          if (signUpCooldownInterval) clearInterval(signUpCooldownInterval);
          signUpCooldownInterval = setInterval(() => {
            secondsLeft -= 1;
            if (secondsLeft <= 0) {
              clearInterval(signUpCooldownInterval);
              isSignUpSubmitting = false;
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-sparkles"></i> <span>Create AYRA Account</span>';
              }
            } else if (submitBtn) {
              submitBtn.innerHTML = `<i class="fa-regular fa-clock"></i> <span>Please wait ${secondsLeft}s...</span>`;
            }
          }, 1000);

        } else {
          isSignUpSubmitting = false;
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-sparkles"></i> <span>Create AYRA Account</span>';
          }
          showAuthFeedback(res.friendlyMessage || res.error || 'Failed to create account. Please try again.');
        }
      }
    });
  }

  // Forgot Password Form Submission with Double-Submit Protection
  let isForgotSubmitting = false;
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');
  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isForgotSubmitting) return;

      clearAuthFeedback();

      const email = document.getElementById('forgotPasswordEmail').value.trim();
      const submitBtn = document.getElementById('forgotPasswordSubmitBtn');

      if (!email) {
        showAuthFeedback('Please enter your registered email address.');
        return;
      }

      isForgotSubmitting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Sending link...</span>';
      }

      const res = await window.AyraBackend.resetPassword(email);

      isForgotSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-regular fa-paper-plane"></i> <span>Send Reset Link</span>';
      }

      if (res.success) {
        showAuthFeedback('Password reset link sent! Please check your inbox.', 'success');
        forgotPasswordForm.reset();
      } else {
        showAuthFeedback(res.friendlyMessage || res.error || 'Unable to send reset link. Please verify your email.');
      }
    });
  }

  // Sign Out Handlers
  async function performSignOut() {
    if (authDropdownMenu) authDropdownMenu.classList.remove('active');
    closeModal(dashboardModal);

    await window.AyraBackend.signOut();
    currentAuthUser = null;
    currentUserProfile = null;
    updateHeaderAuthState(null);
    showToast('You have been safely signed out.', 'info', 'fa-arrow-right-from-bracket');
  }

  document.getElementById('dropdownSignOutBtn')?.addEventListener('click', performSignOut);
  document.getElementById('btnDashSignOut')?.addEventListener('click', performSignOut);

  // Update Header UI according to current auth state
  function updateHeaderAuthState(profile) {
    if (profile) {
      // User is logged in
      if (headerAuthBtn) {
        headerAuthBtn.classList.add('authenticated');
        const initial = (profile.full_name || 'A').charAt(0).toUpperCase();
        headerAuthBtn.innerHTML = `
          <span class="auth-user-avatar">${initial}</span>
          <span class="auth-btn-label">${profile.full_name?.split(' ')[0] || 'Member'}</span>
          <i class="fa-solid fa-chevron-down" style="font-size: 0.75rem;"></i>
        `;
        headerAuthBtn.setAttribute('title', `Logged in as ${profile.full_name}`);
      }

      // Update Dropdown Details
      const dropName = document.getElementById('dropdownUserName');
      const dropEmail = document.getElementById('dropdownUserEmail');
      const dropRole = document.getElementById('dropdownUserRole');
      if (dropName) dropName.textContent = profile.full_name || 'AYRA Member';
      if (dropEmail) dropEmail.textContent = profile.email || '';
      if (dropRole) dropRole.textContent = (profile.role || 'beneficiary').toUpperCase();

      // Mobile drawer
      if (drawerAuthBtn) {
        const label = document.getElementById('drawerAuthLabel');
        if (label) label.textContent = `My Account (${profile.full_name?.split(' ')[0] || 'Member'})`;
      }

      // Auto-fill form fields for convenience
      const wName = document.getElementById('wName');
      const wEmail = document.getElementById('wEmail');
      const wPhone = document.getElementById('wPhone');
      const wCity = document.getElementById('wCity');
      if (wName && !wName.value) wName.value = profile.full_name || '';
      if (wEmail && !wEmail.value) wEmail.value = profile.email || '';
      if (wPhone && !wPhone.value && profile.phone) wPhone.value = profile.phone;
      if (wCity && !wCity.value && profile.city) wCity.value = profile.city;

      const cName = document.getElementById('contactName');
      const cEmail = document.getElementById('contactEmail');
      const cPhone = document.getElementById('contactPhone');
      if (cName && !cName.value) cName.value = profile.full_name || '';
      if (cEmail && !cEmail.value) cEmail.value = profile.email || '';
      if (cPhone && !cPhone.value && profile.phone) cPhone.value = profile.phone;

    } else {
      // User is logged out
      if (headerAuthBtn) {
        headerAuthBtn.classList.remove('authenticated');
        headerAuthBtn.innerHTML = `
          <i class="fa-regular fa-circle-user"></i>
          <span class="auth-btn-label">Sign In</span>
        `;
        headerAuthBtn.setAttribute('title', 'Sign In or Register');
      }

      if (drawerAuthBtn) {
        const label = document.getElementById('drawerAuthLabel');
        if (label) label.textContent = 'Sign In / Register';
      }
    }
  }

  // Refresh and fetch active auth state
  async function refreshAuthState() {
    if (!window.AyraBackend) return;
    try {
      const profile = await window.AyraBackend.getUserProfile();
      currentUserProfile = profile;
      currentAuthUser = profile ? { id: profile.id, email: profile.email } : null;
      updateHeaderAuthState(profile);
    } catch (err) {
      console.warn('Auth state check error:', err);
    }
  }

  // -------------------------------------------------------------------------
  // USER DASHBOARD LOGIC
  // -------------------------------------------------------------------------
  function openDashboardModal(defaultTab = 'tabProfile') {
    if (!currentUserProfile) {
      openAuthModal('signIn');
      return;
    }

    if (authDropdownMenu) authDropdownMenu.classList.remove('active');

    // Populate profile card
    const avatarInitial = document.getElementById('dashAvatarInitial');
    const nameEl = document.getElementById('dashUserFullName');
    const emailEl = document.getElementById('dashUserEmail');
    const roleBadge = document.getElementById('dashUserRoleBadge');

    if (avatarInitial) avatarInitial.textContent = (currentUserProfile.full_name || 'A').charAt(0).toUpperCase();
    if (nameEl) nameEl.textContent = currentUserProfile.full_name || 'AYRA Member';
    if (emailEl) emailEl.textContent = currentUserProfile.email || '';
    if (roleBadge) roleBadge.textContent = (currentUserProfile.role || 'beneficiary').toUpperCase();

    // Populate profile form inputs
    const pName = document.getElementById('profFullName');
    const pPhone = document.getElementById('profPhone');
    const pCity = document.getElementById('profCity');
    const pState = document.getElementById('profState');
    const pLang = document.getElementById('profLanguage');

    if (pName) pName.value = currentUserProfile.full_name || '';
    if (pPhone) pPhone.value = currentUserProfile.phone || '';
    if (pCity) pCity.value = currentUserProfile.city || '';
    if (pState) pState.value = currentUserProfile.state || '';
    if (pLang) pLang.value = currentUserProfile.preferred_language || 'en';

    // Switch to target tab
    switchDashboardTab(defaultTab);

    // Load registered workshops and inquiries
    loadUserRegistrations();
    loadUserInquiries();

    openModal(dashboardModal);
  }

  // Dashboard tab switching
  function switchDashboardTab(tabId) {
    document.querySelectorAll('.dash-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.dash-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === tabId);
    });
  }

  document.querySelectorAll('.dash-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      switchDashboardTab(tabId);
    });
  });

  // Open Dashboard from dropdown items
  document.getElementById('dropdownDashboardBtn')?.addEventListener('click', () => openDashboardModal('tabWorkshops'));
  document.getElementById('dropdownProfileBtn')?.addEventListener('click', () => openDashboardModal('tabProfile'));

  // Load User Registered Workshops
  async function loadUserRegistrations() {
    const listEl = document.getElementById('dashWorkshopsList');
    if (!listEl) return;

    listEl.innerHTML = '<p class="empty-list-notice"><i class="fa-solid fa-spinner fa-spin"></i> Loading your registrations...</p>';
    const registrations = await window.AyraBackend.getUserWorkshops();

    if (!registrations || registrations.length === 0) {
      listEl.innerHTML = `
        <div class="empty-list-notice">
          <i class="fa-regular fa-calendar-xmark"></i>
          <p>You have not registered for any upcoming workshops yet.</p>
          <a href="#community" class="btn btn-secondary btn-sm" onclick="closeModal(document.getElementById('dashboardModal'))" style="margin-top:0.75rem;">
            Explore Free Workshops
          </a>
        </div>
      `;
      return;
    }

    listEl.innerHTML = registrations.map(reg => {
      const workshopTitle = reg.workshops?.title || 'AYRA Community Workshop';
      const eventDate = reg.workshops?.event_date ? new Date(reg.workshops.event_date).toLocaleDateString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Upcoming Session';
      return `
        <div class="dash-card-item">
          <div class="dash-card-item-left">
            <h5>${workshopTitle}</h5>
            <p><i class="fa-regular fa-clock"></i> ${eventDate} • Status: <strong style="color:var(--c-success);">${reg.status || 'Confirmed'}</strong></p>
          </div>
          <span class="dash-ticket-pill">${reg.ticket_code}</span>
        </div>
      `;
    }).join('');
  }

  // Load User Inquiries
  async function loadUserInquiries() {
    const listEl = document.getElementById('dashInquiriesList');
    if (!listEl) return;

    listEl.innerHTML = '<p class="empty-list-notice"><i class="fa-solid fa-spinner fa-spin"></i> Loading inquiries...</p>';
    const inquiries = await window.AyraBackend.getUserInquiries();

    if (!inquiries || inquiries.length === 0) {
      listEl.innerHTML = `
        <div class="empty-list-notice">
          <i class="fa-regular fa-comment-dots"></i>
          <p>No confidential inquiries recorded for your account.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = inquiries.map(inq => {
      const date = inq.created_at ? new Date(inq.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'Recent';
      return `
        <div class="dash-card-item">
          <div class="dash-card-item-left">
            <h5>${inq.subject || 'Support Inquiry'}</h5>
            <p><i class="fa-regular fa-calendar"></i> ${date} • Status: <strong>${inq.status || 'Received'}</strong></p>
          </div>
          <span class="badge-role" style="background:#FFF9F1; border:1px solid var(--c-soft-purple);">${inq.status || 'new'}</span>
        </div>
      `;
    }).join('');
  }

  // Profile Form Update Handler
  const profileUpdateForm = document.getElementById('profileUpdateForm');
  if (profileUpdateForm) {
    profileUpdateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('btnSaveProfile');
      const fullName = document.getElementById('profFullName').value.trim();
      const phone = document.getElementById('profPhone').value.trim();
      const city = document.getElementById('profCity').value.trim();
      const state = document.getElementById('profState').value.trim();
      const preferredLanguage = document.getElementById('profLanguage').value;

      if (!fullName) {
        showToast('Full name is required.', 'warning', 'fa-circle-exclamation');
        return;
      }

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
      }

      const res = await window.AyraBackend.updateProfile({
        full_name: fullName,
        phone,
        city,
        state,
        preferred_language: preferredLanguage
      });

      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Profile Changes';
      }

      if (res.success) {
        showToast('Profile updated successfully!', 'success', 'fa-circle-check');
        await refreshAuthState();
      } else {
        showToast(`Update failed: ${res.error || 'Please try again.'}`, 'warning', 'fa-circle-exclamation');
      }
    });
  }

  // Password Update Handler
  const changePasswordForm = document.getElementById('changePasswordForm');
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPassword = document.getElementById('newPassword').value;
      const confirmNewPassword = document.getElementById('confirmNewPassword').value;
      const btn = document.getElementById('btnUpdatePassword');

      if (!newPassword || newPassword.length < 6) {
        showToast('Password must be at least 6 characters.', 'warning', 'fa-lock');
        return;
      }

      if (newPassword !== confirmNewPassword) {
        showToast('Passwords do not match.', 'warning', 'fa-circle-exclamation');
        return;
      }

      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
      }

      const res = await window.AyraBackend.updatePassword(newPassword);

      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-key"></i> Update Password';
      }

      if (res.success) {
        showToast('Password updated securely!', 'success', 'fa-circle-check');
        changePasswordForm.reset();
      } else {
        showToast(`Password update failed: ${res.error || 'Please try again.'}`, 'warning', 'fa-triangle-exclamation');
      }
    });
  }

  // Listen to Auth State Changes in real time (Login, Email Confirmation, Password Recovery)
  if (window.AyraBackend && typeof window.AyraBackend.onAuthStateChange === 'function') {
    window.AyraBackend.onAuthStateChange(async (event, session) => {
      console.log('[AYRA Auth Event]:', event, session?.user?.email);

      if (event === 'PASSWORD_RECOVERY') {
        // User clicked a password recovery link from their email
        openDashboardModal('tabSecurity');
        showToast('Password recovery authorized! Please enter your new password below.', 'info', 'fa-key');
      } else if (session?.user) {
        // User is authenticated (signed in or confirmed email)
        const hadAuthHash = window.location.hash.includes('access_token') || window.location.hash.includes('type=signup');
        if (hadAuthHash) {
          // Clean URL hash after confirmation
          window.history.replaceState(null, null, window.location.pathname);
          showToast(`Email confirmed! Welcome to AYRA, ${session.user.user_metadata?.full_name || 'Sister'}!`, 'success', 'fa-shield-heart');
        }
        await refreshAuthState();
      } else {
        currentAuthUser = null;
        currentUserProfile = null;
        updateHeaderAuthState(null);
      }
    });
  }

  // Check auth state on initial boot
  refreshAuthState();

  // Close modals when close button clicked
  document.getElementById('authModalCloseBtn')?.addEventListener('click', () => closeModal(authModal));
  document.getElementById('dashboardModalCloseBtn')?.addEventListener('click', () => closeModal(dashboardModal));

  // Check database connection on load
  checkDbConnection(false);

  // Check on click with user toast feedback
  if (dbStatusBadge) {
    dbStatusBadge.addEventListener('click', () => {
      checkDbConnection(true);
    });
  }

});

