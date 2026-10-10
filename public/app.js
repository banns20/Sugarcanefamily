const root = document.querySelector("#root");
const toastRoot = document.querySelector("#toast-root");
const contextKey = "mavuno-market-context";
const savedKey = "mavuno-saved-listings";
const defaultCrops = [
  { id: "sugarcane", name: "Sugarcane", standingLabel: "Standing sugarcane", fieldLabel: "Sugarcane variety" },
];
const fieldArticles = [
  {
    id: "prepare-land",
    category: "Land preparation",
    readTime: "4 min read",
    title: "A practical checklist before planting sugarcane",
    excerpt: "A little planning before planting can make the season easier to manage. Start with the land, water, access, and a clear agreement.",
    paragraphs: [
      "Before planting, walk the whole plot and note its boundaries, slope, drainage, and access route. Confirm that the land is available for the full growing period you have in mind.",
      "Talk through water availability and how the field will be prepared. Agree who is responsible for clearing, ploughing, planting materials, and any shared access roads.",
      "Write down the lease period, payment dates, acreage, and responsibilities before work begins. Keep a copy of the agreement and make sure everyone involved understands it.",
    ],
  },
  {
    id: "standing-cane",
    category: "Buying standing cane",
    readTime: "3 min read",
    title: "What to check when viewing a standing cane crop",
    excerpt: "A field visit helps you understand the crop, the harvest timing, and how cane can be moved from the farm.",
    paragraphs: [
      "Visit the field with the grower and confirm the acreage and exact boundaries. Look across the plot rather than judging the crop from one corner, and ask about the variety and planting or ratoon history.",
      "Ask how the expected harvest window was estimated and what work remains before cutting. Discuss who arranges harvesting, loading, and transport, and whether there are any mill or delivery requirements.",
      "Make sure the price, payment timing, and responsibilities are clear in writing. If anything is uncertain, pause and get it clarified before paying or making commitments.",
    ],
  },
  {
    id: "harvest-planning",
    category: "Harvest planning",
    readTime: "4 min read",
    title: "Plan the harvest before the cane is ready",
    excerpt: "Coordinate people, transport, and delivery details early so the harvest plan is clear to everyone.",
    paragraphs: [
      "Start by agreeing on a realistic harvest window with the grower and confirming any delivery arrangements. Ask what needs to happen before cutting and who will coordinate each step.",
      "Check that access roads can accommodate the expected vehicles and discuss how loading will be handled. Rain, road conditions, and transport availability can affect timing, so identify a backup plan.",
      "Keep the grower, harvesting team, and transporter updated if dates change. A shared written schedule helps avoid confusion about quantities, responsibilities, and payment.",
    ],
  },
];
const icons = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  leaf: '<path d="M20 4c-8 0-14 4-14 11a5 5 0 0 0 5 5c7 0 11-6 11-14V4ZM4 21c2-5 6-8 11-11"/>',
  map: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  sliders: '<path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  sparkle: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
  swap: '<path d="M16 3 20 7l-4 4M4 7h16M8 21l-4-4 4-4m12 4H4"/>',
  x: '<path d="m18 6-12 12M6 6l12 12"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3m.1 4h.01"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
};

function icon(name, size = 16, extra = "") {
  return `<svg ${extra} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ""}</svg>`;
}

function readContext() {
  try {
    const context = JSON.parse(localStorage.getItem(contextKey));
    if (
      defaultCrops.some((crop) => crop.id === context?.crop) &&
      ["buyer", "seller"].includes(context?.role)
    ) return context;
  } catch {
    return null;
  }
  return null;
}

function readSaved() {
  try {
    const value = JSON.parse(localStorage.getItem(savedKey));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

const savedContext = readContext();
const state = {
  market: savedContext || { crop: "sugarcane", role: "buyer" },
  selectedCrop: savedContext?.crop || "sugarcane",
  selectedRole: savedContext?.role || "buyer",
  crops: defaultCrops,
  counties: [],
  listings: [],
  user: null,
  notifications: [],
  unreadNotificationCount: 0,
  notificationPreferenceDraft: null,
  loading: true,
  search: "",
  place: "Everywhere",
  deal: "All land",
  sort: "Recommended",
  minAcres: 0,
  saved: readSaved(),
  showSaved: false,
  modal: savedContext ? null : { type: "onboarding" },
  selected: null,
  contactPhone: "",
  contactLocation: null,
  paymentFlow: null,
  authMode: "login",
  toast: "",
  listingKind: "Standing sugarcane",
  mapPin: null,
  postCounty: "",
  postLocality: "",
  locationResults: [],
  locationLoading: false,
  locationMap: null,
  locationMapFrame: null,
  locationMarker: null,
};

const cropInfo = () => state.crops.find((crop) => crop.id === state.market.crop) || defaultCrops[0];
const cropTitle = () => cropInfo().name.toLowerCase();
const savedForCrop = () => state.saved[state.market.crop] || [];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));
const money = (amount) => `KSh ${Number(amount).toLocaleString("en-KE")}`;
const imageUrl = (image) => image?.startsWith("http") ? image : image || "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=82";
const countyOptions = (selected = "") => `<option value="" ${selected ? "" : "selected"} disabled>Choose county</option>${state.counties.map((county) => `<option value="${escapeHtml(county)}" ${county === selected ? "selected" : ""}>${escapeHtml(county)}</option>`).join("")}`;

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Cannot reach the marketplace server. Start it with npm run dev and open the same localhost port.");
    }
    throw error;
  }
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "The request could not be completed.");
    error.status = response.status;
    error.paymentRequired = data.paymentRequired === true;
    throw error;
  }
  return data;
}

function notify(message) {
  state.toast = message;
  renderToast();
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => {
    state.toast = "";
    renderToast();
  }, 3200);
}

function renderToast() {
  toastRoot.innerHTML = state.toast ? `<div class="toast"><span>${icon("check", 15)}</span>${escapeHtml(state.toast)}</div>` : "";
}

function filteredListings() {
  const query = state.search.trim().toLowerCase();
  return state.listings.filter((listing) => {
    const matchesQuery = !query || `${listing.title} ${listing.district} ${listing.crop} ${listing.seller}`.toLowerCase().includes(query);
    return matchesQuery &&
      (state.place === "Everywhere" || listing.county === state.place) &&
      (state.deal === "All land" || listing.kind === state.deal) &&
      (!state.showSaved || savedForCrop().includes(listing.id)) &&
      listing.acres >= state.minAcres;
  }).sort((a, b) => state.sort === "Price: low to high" ? a.rate - b.rate : state.sort === "Most acres" ? b.acres - a.acres : 0);
}

function listingCard(listing) {
  const saved = savedForCrop().includes(listing.id);
  const isStanding = listing.kind === cropInfo().standingLabel;
  return `<article class="listing-card">
    <button class="listing-photo" data-action="details" data-id="${listing.id}" aria-label="View ${escapeHtml(listing.title)}">
      <img src="${escapeHtml(imageUrl(listing.image))}" alt="${escapeHtml(`${listing.kind} in ${listing.locality}, ${listing.county}`)}" loading="lazy" />
      <span class="deal-tag ${isStanding ? "deal-tag--harvest" : ""}">${escapeHtml(listing.kind)}</span>
      <span class="photo-caption">${icon("sparkle", 13)} ${escapeHtml(listing.tag)}</span>
    </button>
    <button class="save-button ${saved ? "is-saved" : ""}" data-action="save" data-id="${listing.id}" aria-label="${saved ? "Remove from saved" : "Save listing"}" aria-pressed="${saved}">${icon("heart", 18, saved ? 'style="fill:currentColor"' : "")}</button>
    <div class="listing-content">
      <div class="listing-title-row"><h3>${escapeHtml(listing.title)}</h3><span class="posted-time">${escapeHtml(listing.posted)}</span></div>
      <p class="listing-location">${icon("map", 14)} ${escapeHtml(listing.district)}</p>
      <div class="listing-facts"><span><strong>${escapeHtml(listing.acres)}</strong> acres</span><span class="fact-divider"></span><span>${escapeHtml(listing.crop)}</span></div>
      <div class="listing-footer"><div class="price-block"><strong>${money(listing.rate)}</strong><span>${isStanding ? " / acre · crop" : " / acre · year"}</span></div>
        <button class="text-link" data-action="details" data-id="${listing.id}">Details ${icon("arrow", 15)}</button></div>
      <div class="seller-line"><span class="seller-avatar">${listing.verified ? icon("check", 12) : icon("leaf", 12)}</span><span>${escapeHtml(listing.seller)}</span>${listing.verified ? `<span class="verified-mark" title="SugarcaneFamily member">${icon("check", 11)}</span><small>Member</small>` : ""}</div>
    </div>
  </article>`;
}

function articleCard(article) {
  return `<article class="article-card"><span class="article-icon">${icon("leaf", 21)}</span>
    <div class="article-meta"><span>${escapeHtml(article.category)}</span><span>${escapeHtml(article.readTime)}</span></div>
    <h3>${escapeHtml(article.title)}</h3><p>${escapeHtml(article.excerpt)}</p>
    <button class="article-link" data-action="read-article" data-id="${escapeHtml(article.id)}">Read article ${icon("arrow", 15)}</button></article>`;
}

function renderMarket() {
  const crop = cropInfo();
  const listings = filteredListings();
  const tabs = ["All land", crop.standingLabel, "Land for lease"];
  return `<section class="market section-wrap" id="market">
    <div class="section-heading"><div><div class="eyebrow eyebrow--dark"><span class="eyebrow-line"></span> ${escapeHtml(crop.name.toUpperCase())} MARKETPLACE</div>
      <h2>Find your <em>patch.</em></h2><p>Browse ${escapeHtml(cropTitle())} already growing or land ready to plant.</p></div>
      <div class="market-aside"><span class="live-dot"></span><strong>${state.listings.length} open listings</strong><span>for ${escapeHtml(cropTitle())}</span></div></div>
    <div class="search-bar"><label class="search-input-wrap">${icon("search", 19)}<input data-field="search" value="${escapeHtml(state.search)}" placeholder="Try a town, county, or grower" aria-label="Search listings" /><kbd>⌘ K</kbd></label>
      <label class="select-wrap">${icon("map", 17)}<select data-field="place" aria-label="Filter by county"><option>Everywhere</option>${state.counties.map((county) => `<option ${state.place === county ? "selected" : ""}>${escapeHtml(county)}</option>`).join("")}</select>${icon("down", 15)}</label>
      <button class="filter-button" data-action="filters">${icon("sliders", 17)}<span>Filters</span></button></div>
    <div class="market-controls"><div class="deal-tabs" role="tablist" aria-label="Listing type">${tabs.map((tab) => `<button role="tab" aria-selected="${state.deal === tab}" class="${state.deal === tab ? "tab-active" : ""}" data-action="deal" data-value="${escapeHtml(tab)}">${escapeHtml(tab)}<span>${tab === "All land" ? state.listings.length : state.listings.filter((listing) => listing.kind === tab).length}</span></button>`).join("")}</div>
      <div class="sort-wrap">${icon("swap", 15)}<label for="sort-listings">Sort:</label><select id="sort-listings" data-field="sort"><option ${state.sort === "Recommended" ? "selected" : ""}>Recommended</option><option ${state.sort === "Price: low to high" ? "selected" : ""}>Price: low to high</option><option ${state.sort === "Most acres" ? "selected" : ""}>Most acres</option></select>${icon("down", 14)}</div></div>
    ${state.showSaved ? `<div class="saved-banner">${icon("heart", 16)} Showing your saved listings<button data-action="all-listings">Show all land ${icon("arrow", 14)}</button></div>` : ""}
    ${state.loading ? `<div class="empty-state"><span>${icon("leaf", 22)}</span><h3>Finding good ground...</h3><p>Loading the ${escapeHtml(cropTitle())} marketplace.</p></div>` :
      listings.length ? `<div class="listing-grid">${listings.map(listingCard).join("")}</div>` :
        `<div class="empty-state"><span>${icon("search", 22)}</span><h3>${state.listings.length ? "No listings match these filters" : "No land or standing sugarcane posted yet"}</h3><p>${state.listings.length ? "Try another county, listing type, or search." : "Check back soon for the first grower listing."}</p>${state.listings.length ? "" : state.market.role === "seller" ? `<button class="button button--green" data-action="post">${icon("plus", 16)} Post the first listing</button>` : `<button class="button button--green" data-action="context">Choose seller mode</button>`}</div>`}
    <div class="browse-footer"><span>Showing <strong>${listings.length}</strong> of <strong>${state.listings.length}</strong> ${escapeHtml(cropTitle())} listings</span>
      <button class="button button--outline" data-action="${state.market.role === "seller" ? "post" : "context"}">${state.market.role === "seller" ? "Have sugarcane to share? <strong>Post it here</strong>" : "Switch buyer or seller mode <strong>Choose</strong>"} ${icon("arrow", 16)}</button></div>
  </section>`;
}

function renderPage() {
  const crop = cropInfo();
  const title = cropTitle();
  const modal = renderModal();
  return `<div class="app-shell">
    <header class="topbar"><a class="brand" href="#top" aria-label="SugarcaneFamily home"><span class="brand-mark">${icon("leaf", 20)}</span><span class="brand-name">sugarcane<span>family</span></span></a>
      <nav class="main-nav" aria-label="Main navigation"><a class="nav-active" href="#market">Marketplace</a><a href="#how-it-works">How it works</a><a href="#field-notes">Field notes</a><button class="context-nav" data-action="context">${escapeHtml(crop.name)} · ${state.market.role === "buyer" ? "Buyer" : "Seller"} ${icon("down", 14)}</button></nav>
      <div class="top-actions"><button class="saved-nav ${state.showSaved ? "saved-nav--active" : ""}" data-action="toggle-saved">${icon("heart", 17)}<span>Saved</span>${savedForCrop().length ? `<b>${savedForCrop().length}</b>` : ""}</button>
      ${state.user ? `<button class="notification-nav" data-action="notifications" aria-label="Notifications${state.unreadNotificationCount ? `, ${state.unreadNotificationCount} unread` : ""}">${icon("bell", 18)}${state.unreadNotificationCount ? `<span class="notification-count">${state.unreadNotificationCount > 99 ? "99+" : state.unreadNotificationCount}</span>` : ""}</button><button class="account-nav" data-action="profile" title="Edit your profile">${escapeHtml(state.user.displayName || state.user.phone)}<span>Profile</span></button><button class="signin-nav" data-action="signout">Sign out</button>` : `<button class="signin-nav" data-action="login">Sign in</button>`}
      ${state.market.role === "seller" ? `<button class="button button--green button--nav" data-action="post">${icon("plus", 17)} Post a listing</button>` : ""}
      <button class="mobile-menu" data-action="menu" aria-label="Open menu">${icon("menu", 22)}</button></div></header>
    <main id="top"><section class="hero"><div class="hero-image" role="img" aria-label="Sunlit Kenyan farmland"></div><div class="hero-content"><div class="eyebrow"><span class="eyebrow-line"></span> KENYA'S ${escapeHtml(crop.name.toUpperCase())} MARKETPLACE</div>
      <h1>Good ground.<br><em>Good growing.</em></h1><p>Find ${escapeHtml(title)} already growing, or lease the right land to plant your next crop.</p>
      <a class="hero-link" href="#market">Explore ${escapeHtml(title)} listings ${icon("arrow", 17)}</a></div>
      <div class="hero-note"><span class="note-icon">${icon("leaf", 17)}</span><span><strong>Rooted in Kenya</strong><small>Made for local growers</small></span></div>
      <div class="hero-count"><strong>${state.listings.length}</strong><span>${escapeHtml(title)} plots<br>ready to grow</span></div><span class="hero-sun sun-one"></span><span class="hero-sun sun-two"></span></section>
    ${renderMarket()}
    <section class="grower-strip" id="how-it-works"><div class="grower-strip-inner"><div class="grower-stamp">${icon("leaf", 27)}<span>GROW<br>TOGETHER</span></div>
      <div><div class="eyebrow eyebrow--light"><span class="eyebrow-line"></span> A BETTER WAY TO GROW</div><h2>Land brings us<br><em>together.</em></h2></div>
      <p>See the crop or land clearly, agree on terms directly, and connect with growers across Kenya.</p><a href="#market" class="strip-link">Find your next opportunity ${icon("arrow", 17)}</a></div>
      <span class="strip-leaf leaf-a">${icon("leaf", 36)}</span><span class="strip-leaf leaf-b">${icon("leaf", 36)}</span></section>
    <section class="field-notes section-wrap" id="field-notes"><div class="section-heading field-notes-heading"><div><div class="eyebrow eyebrow--dark"><span class="eyebrow-line"></span> FROM THE FIELD</div><h2>Ideas to help you <em>grow.</em></h2><p>Practical notes for growers, buyers, and landowners.</p></div><span class="field-notes-mark">${icon("book", 22)} Grower journal</span></div>
      <div class="article-grid">${fieldArticles.map(articleCard).join("")}</div></section>
    <section class="bottom-note section-wrap" id="grower-notes"><div><span class="note-spark">✳</span><span>Better growing starts with a conversation.</span></div><a href="mailto:sugarcanefamily97@gmail.com">Questions? Talk to our team ${icon("arrow", 15)}</a></section></main>
    <footer class="footer"><a class="brand brand--footer" href="#top" aria-label="SugarcaneFamily home"><span class="brand-mark">${icon("leaf", 17)}</span><span class="brand-name">sugarcane<span>family</span></span></a><span>For the people who grow what we all need.</span><span>Kenya · KSh</span></footer>${modal}</div>`;
}

function renderModal() {
  if (!state.modal) return "";
  const crop = cropInfo();
  const backdrop = (contents, extra = "") => `<div class="modal-backdrop ${extra}" data-action="backdrop">${contents}</div>`;
  const heading = (eyebrow, title, description = "") => `<div class="modal-heading"><div><span class="eyebrow eyebrow--dark"><span class="eyebrow-line"></span> ${eyebrow}</span><h2>${title}</h2>${description ? `<p>${description}</p>` : ""}</div><button class="close-button" data-action="close" aria-label="Close">${icon("x", 22)}</button></div>`;

  if (state.modal.type === "onboarding") {
    return backdrop(`<section class="modal onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title"><div class="onboarding-mark">${icon("leaf", 20)}</div>
      <span class="eyebrow eyebrow--dark"><span class="eyebrow-line"></span> YOUR LOCAL CROP MARKET</span><h2 id="onboarding-title">First, choose your <em>market.</em></h2>
      <p class="onboarding-intro">Browse and post sugarcane listings, or contact growers directly.</p>
      <span class="onboarding-label">How would you like to use this marketplace?</span><div class="role-choices">
      <button class="role-choice ${state.selectedRole === "buyer" ? "role-choice--active" : ""}" data-action="role" data-value="buyer">${icon("search", 19)}<span><strong>Buyer</strong><small>Browse sugarcane and contact growers</small></span>${state.selectedRole === "buyer" ? icon("check", 16) : ""}</button>
      <button class="role-choice ${state.selectedRole === "seller" ? "role-choice--active" : ""}" data-action="role" data-value="seller">${icon("plus", 19)}<span><strong>Seller</strong><small>Post sugarcane crops or land for lease</small></span>${state.selectedRole === "seller" ? icon("check", 16) : ""}</button></div>
      <button class="button button--green onboarding-submit" data-action="confirm-context">Enter sugarcane market ${icon("arrow", 17)}</button>
      <small class="onboarding-footnote">This marketplace is exclusively for sugarcane.</small></section>`, "onboarding-backdrop");
  }

  if (state.modal.type === "auth") {
    const signup = state.authMode === "signup";
    return backdrop(`<section class="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">${heading(`${escapeHtml(crop.name.toUpperCase())} · ${state.market.role.toUpperCase()}`, ` <span id="auth-title">${signup ? "Join the <em>market.</em>" : "Welcome <em>back.</em>"}</span>`, signup ? `Create your ${state.market.role} account. Your details are saved securely so you can sign in again later.` : `Use the Kenyan phone number and password you registered with. New here? Create an account below first.`)}
      <form class="auth-form" data-form="auth"><label>Kenyan mobile number<input name="phone" type="tel" autocomplete="tel" placeholder="0712 345 678" required></label>
      <label>Password<input name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" minlength="8" maxlength="128" placeholder="At least 8 characters" required></label>
      ${signup ? "" : `<label class="remember-me"><input name="rememberMe" type="checkbox" checked><span>Keep me signed in on this device</span></label>`}
      <button class="button button--green form-submit" type="submit">${signup ? "Create account" : "Sign in"} ${icon("arrow", 16)}</button></form>
      <p class="auth-switch">${signup ? "Already have an account?" : "New to this crop market?"} <button data-action="toggle-auth">${signup ? "Sign in" : "Create an account"}</button></p>
      <p class="form-footnote">${icon("help", 14)} Your account is separate from other crop marketplaces.</p></section>`);
  }

  if (state.modal.type === "payment" && state.paymentFlow) {
    const flow = state.paymentFlow;
    const waiting = ["starting", "waiting", "pending"].includes(flow.status);
    const sellerPayment = flow.purpose === "seller_listing_credit";
    return backdrop(`<section class="modal payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title">
      ${heading(sellerPayment ? "SELLER POSTING" : "BUYER LAND CHECK", `<span id="payment-title">${sellerPayment ? "Unlock one <em>listing.</em>" : "Reveal grower <em>details.</em>"}</span>`, sellerPayment ? "One KSh 500 payment adds a listing credit to your account." : "One KSh 500 payment unlocks this listing’s seller contact and precise map pin.")}
      <div class="payment-summary"><span>${icon("check", 18)}</span><div><strong>KSh 500</strong><small>${sellerPayment ? "One reusable listing credit" : "Contact and location for this listing"}</small></div></div>
      ${waiting ? `<div class="payment-progress" role="status" aria-live="polite"><span class="payment-progress-mark">${icon("sparkle", 18)}</span><div><strong>${flow.status === "starting" ? "Connecting to M-Pesa…" : flow.status === "pending" ? "Payment still processing" : "Check your phone"}</strong><p>${flow.status === "starting" ? "Please wait while we request a secure M-Pesa prompt." : "Approve the KSh 500 prompt on your phone. We’ll verify it with Safaricom before unlocking anything."}</p></div></div>
        ${flow.status === "pending" ? `<button class="button button--green form-submit" type="button" data-action="check-payment">Check payment status ${icon("arrow", 16)}</button>` : ""}` : `<form class="payment-form" data-form="payment"><label>Safaricom number for M-Pesa<input name="phone" type="tel" autocomplete="tel" value="${escapeHtml(flow.phone || state.user?.phone || "")}" placeholder="0712 345 678" required></label>
        <button class="button button--green form-submit" type="submit">Send KSh 500 M-Pesa prompt ${icon("arrow", 16)}</button></form>`}
      <p class="form-footnote">${icon("help", 14)} Your details unlock only after Safaricom confirms this payment.</p></section>`);
  }

  if (state.modal.type === "post") {
    const isStanding = state.listingKind === crop.standingLabel;
    const hasListingCredit = Number(state.user?.listingCredits) > 0;
    return backdrop(`<section class="modal post-modal" role="dialog" aria-modal="true" aria-labelledby="post-title">${heading("SUGARCANE SELLER", `Share your <em>sugarcane.</em>`, "A listing credit lets you publish one sugarcane offer.")}
      <form class="listing-form" data-form="listing" enctype="multipart/form-data">
      ${hasListingCredit ? `<label class="form-full">Listing title<input name="title" minlength="5" maxlength="100" placeholder="e.g. ${escapeHtml(crop.standingLabel)} near Mumias" required></label>
      <div class="form-full listing-type-choice" role="radiogroup" aria-label="What are you listing?"><span class="choice-label">What are you offering?</span><div>
        <label class="${isStanding ? "choice-active" : ""}"><input type="radio" name="kind" value="${escapeHtml(crop.standingLabel)}" ${isStanding ? "checked" : ""}>${icon("leaf", 16)}<span>${escapeHtml(crop.standingLabel)}<small>Crop already growing</small></span></label>
        <label class="${!isStanding ? "choice-active" : ""}"><input type="radio" name="kind" value="Land for lease" ${!isStanding ? "checked" : ""}>${icon("map", 16)}<span>Land for lease<small>Land ready to plant</small></span></label></div></div>
      <label>County<select name="county" data-field="county" required>${countyOptions(state.postCounty)}</select></label>
      <label>Town or area<input name="locality" data-field="locality" value="${escapeHtml(state.postLocality)}" placeholder="Mumias West" minlength="2" maxlength="80" required></label>
      <div class="form-full location-tools"><div class="location-picker-heading"><span class="choice-label">Pin the field on the map <span class="optional-label">Optional</span></span><small>Search for an area, use your device, or tap the map to place a pin.</small></div>
        <div class="location-actions"><button class="button button--outline location-search-button" type="button" data-action="search-location" ${state.locationLoading ? "disabled" : ""}>${icon("search", 15)} ${state.locationLoading ? "Finding location…" : "Find town on map"}</button>
          <button class="button button--outline device-location-button" type="button" data-action="device-location" ${state.locationLoading ? "disabled" : ""}>${icon("map", 15)} Use device location</button></div>
        ${state.locationResults.length ? `<div class="location-results" aria-label="Location search results">${state.locationResults.map((location, index) => `<button type="button" class="location-result" data-action="apply-location" data-index="${index}">${icon("map", 15)}<span>${escapeHtml(location.displayName)}</span><small>${escapeHtml(location.locality)}, ${escapeHtml(location.county)}</small></button>`).join("")}</div>` : ""}
        <div class="location-map-wrap"><div id="listing-location-map" class="location-map" role="application" aria-label="Map of Kenya. Tap to select the listing location."></div><span class="location-map-hint">${state.locationLoading ? "Finding the selected place…" : state.mapPin ? "Tap again to move your pin" : "Tap the map to drop a pin"}</span></div>
        ${state.mapPin ? `<div class="map-pin-status">${icon("map", 14)} <span><strong>Location pinned</strong><small>${escapeHtml(state.mapPin.displayName || `${state.mapPin.latitude.toFixed(4)}, ${state.mapPin.longitude.toFixed(4)}`)}</small></span><button type="button" data-action="clear-pin" aria-label="Remove map pin">${icon("x", 14)}</button></div>` : ""}
        <small class="location-privacy">The precise pin is shared only with a buyer who completes the land check. Map © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>.</small>
        <input type="hidden" name="latitude" value="${state.mapPin?.latitude ?? ""}"><input type="hidden" name="longitude" value="${state.mapPin?.longitude ?? ""}"></div>
      <label>Available acres<input name="acres" type="number" min="0.25" step="0.25" placeholder="4.5" required></label>
      <label>${isStanding ? "Crop price per acre (KSh)" : "Annual lease per acre (KSh)"}<input name="priceKes" type="number" min="1" step="1" placeholder="${isStanding ? "185000" : "28000"}" required></label>
      <label>${escapeHtml(crop.fieldLabel)}<input name="cropVariety" placeholder="${escapeHtml(crop.name)}" minlength="2" maxlength="80" required></label>
      <label>${isStanding ? "Expected harvest" : "Lease period"}<input name="expectedHarvest" placeholder="${isStanding ? "Ready in 3 months" : "3 years"}" maxlength="80"></label>
      <label class="form-full">Describe what you&apos;re offering<textarea name="description" rows="3" minlength="20" maxlength="1000" placeholder="In your own words, describe the crop or land, its condition, access, and what a buyer should know." required></textarea></label>
      <label class="form-full photo-input-label">Your land or crop photo<input name="image" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required><small>JPG, PNG, or WebP · up to 6 MB</small></label>
      <button class="button button--green form-submit" type="submit">Publish listing ${icon("arrow", 17)}</button>` : `<div class="payment-callout form-full"><span class="payment-callout-icon">${icon("leaf", 20)}</span><strong>Publish one listing</strong><p>Pay once to add one credit. It stays on your account until you publish.</p><button class="button button--green" type="button" data-action="listing-credit">Get a listing credit · KSh 500 ${icon("arrow", 16)}</button></div>`}</form>
      <p class="form-footnote">${icon("help", 14)} Use a photo you have the right to share. Your number and precise field pin stay private until a buyer pays for a land check.</p></section>`);
  }

  if (state.modal.type === "details" && state.selected) {
    const listing = state.selected;
    const latitude = state.contactLocation?.latitude;
    const longitude = state.contactLocation?.longitude;
    const isPinned = latitude != null && longitude != null && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
    const mapUrl = isPinned ? `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}` : `https://www.openstreetmap.org/search?query=${encodeURIComponent(listing.district)}`;
    return backdrop(`<section class="modal details-modal" role="dialog" aria-modal="true" aria-labelledby="details-title"><button class="close-button details-close" data-action="close" aria-label="Close">${icon("x", 22)}</button>
      <img class="details-image" src="${escapeHtml(imageUrl(listing.image))}" alt="${escapeHtml(`${listing.kind} in ${listing.locality}`)}"><div class="details-content">
      <span class="deal-tag details-deal ${listing.kind === crop.standingLabel ? "deal-tag--harvest" : ""}">${escapeHtml(listing.kind)}</span><h2 id="details-title">${escapeHtml(listing.title)}</h2>
      <p class="listing-location">${icon("map", 15)} ${escapeHtml(listing.district)}</p><div class="details-price">${money(listing.rate)} <small>${listing.kind === crop.standingLabel ? "/ acre · crop" : "/ acre · year"}</small></div>
      <div class="details-facts"><span><strong>${escapeHtml(listing.acres)}</strong> acres available</span><span>${escapeHtml(listing.crop)}</span><span>${escapeHtml(listing.description || "Contact the grower for more details.")}</span></div>
      ${state.contactPhone ? `<a class="map-link" href="${escapeHtml(mapUrl)}" target="_blank" rel="noreferrer">${icon("map", 15)} ${isPinned ? "Open precise field location" : "View general area on map"} ${icon("arrow", 14)}</a>` : `<p class="map-link map-link--locked">${icon("map", 15)} Precise location included with land check</p>`}
      <div class="contact-grower"><span class="seller-avatar">${icon("leaf", 13)}</span><span><strong>${escapeHtml(listing.seller)}</strong><small>${listing.verified ? "SugarcaneFamily member" : "Example listing"}</small></span>
      ${state.contactPhone ? `<a class="button button--green" href="tel:${escapeHtml(state.contactPhone)}">Call ${escapeHtml(state.contactPhone)}</a>` : `<button class="button button--green" data-action="contact">Land check · KSh 500 ${icon("arrow", 16)}</button>`}</div></div></section>`);
  }

  if (state.modal.type === "filters") {
    return backdrop(`<section class="modal filter-modal" role="dialog" aria-modal="true" aria-labelledby="filter-title">${heading("MAKE IT YOURS", 'More <em>filters.</em>')}
      <label class="filter-check"><input type="checkbox" data-field="show-saved" ${state.showSaved ? "checked" : ""}> Only show my saved listings ${icon("heart", 16)}</label>
      <label class="filter-check"><span>Minimum acres</span><input class="mini-number" data-field="min-acres" type="number" min="0" step="1" placeholder="Any" value="${state.minAcres || ""}"></label>
      <p class="filter-hint">Choose a county and listing type from the marketplace controls to narrow the results.</p>
      <button class="button button--green form-submit" data-action="close">Show ${filteredListings().length} listings ${icon("arrow", 16)}</button></section>`);
  }

  if (state.modal.type === "menu") {
    return backdrop(`<section class="modal mobile-nav-modal"><button class="close-button" data-action="close" aria-label="Close">${icon("x", 22)}</button>
      <a href="#market" data-action="close">Marketplace ${icon("chevron", 17)}</a><a href="#how-it-works" data-action="close">How it works ${icon("chevron", 17)}</a><a href="#field-notes" data-action="close">Field notes ${icon("chevron", 17)}</a>
      <button class="mobile-context-action" data-action="context">${escapeHtml(crop.name)} · ${escapeHtml(state.market.role)} ${icon("down", 15)}</button>
      ${state.user ? `<button class="mobile-context-action" data-action="profile">My profile ${icon("chevron", 15)}</button><button class="mobile-context-action" data-action="signout">Sign out ${icon("chevron", 15)}</button>` : `<button class="mobile-context-action" data-action="login">Sign in ${icon("chevron", 15)}</button>`}
      ${state.market.role === "seller" ? `<button class="button button--green" data-action="post">${icon("plus", 16)} Post a listing</button>` : ""}</section>`);
  }
  if (state.modal.type === "profile") {
    const user = state.user;
    const initials = (user.displayName || "Grower").trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
    const roleLabel = user.role === "seller" ? "Sugarcane seller" : "Sugarcane buyer";
    return backdrop(`<section class="modal profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
      ${heading("YOUR ACCOUNT", "Your <em>profile.</em>", "A clear profile helps local growers know who they’re connecting with.")}
      <div class="profile-summary"><span class="profile-avatar">${escapeHtml(initials)}</span><span class="profile-summary-copy"><strong>${escapeHtml(user.displayName || "Add your name")}</strong><small>${escapeHtml(user.phone)}</small></span><span class="profile-role">${icon(user.role === "seller" ? "leaf" : "search", 13)}${roleLabel}</span></div>
      <form class="profile-form" data-form="profile">
        <div class="profile-fields"><label>Your name<input name="displayName" value="${escapeHtml(user.displayName)}" minlength="2" maxlength="60" autocomplete="name" placeholder="e.g. Amina Wanjiru" required></label>
        <label>Your county <span class="optional-label">Optional</span><select name="county"><option value="">Choose a county</option>${state.counties.map((county) => `<option value="${escapeHtml(county)}" ${county === user.county ? "selected" : ""}>${escapeHtml(county)}</option>`).join("")}</select></label></div>
        <label>About you <span class="optional-label">Optional</span><textarea name="bio" rows="4" maxlength="500" placeholder="Tell people what you grow, where you work, or what you’re looking for.">${escapeHtml(user.bio)}</textarea><small class="profile-hint">Keep it simple—your experience, area, or what kind of sugarcane connection you need.</small></label>
        <label class="notification-preference"><input type="checkbox" name="listingNotificationsEnabled" ${(state.notificationPreferenceDraft ?? user.listingNotificationsEnabled) ? "checked" : ""} ${user.county ? "" : "disabled"}><span><strong>New listings in my county</strong><small>${user.county ? `Get an in-app notification when someone posts in ${escapeHtml(user.county)}.` : "Choose your county above to turn this on."}</small></span></label>
        <div class="profile-contact-note">${icon("help", 15)}<span><strong>Your number isn’t shown on your public profile.</strong><small>It’s shared through listing contact when someone requests it.</small></span></div>
        <button class="button button--green form-submit" type="submit">Save profile ${icon("arrow", 16)}</button>
      </form></section>`);
  }
  if (state.modal.type === "notifications") {
    const notifications = state.notifications;
    return backdrop(`<section class="modal notifications-modal" role="dialog" aria-modal="true" aria-labelledby="notifications-title">
      ${heading("YOUR MARKET", "Your <em>alerts.</em>", "New sugarcane listings posted in your county.")}
      <div class="notifications-toolbar">${state.unreadNotificationCount ? `<span>${state.unreadNotificationCount} unread</span><button data-action="mark-all-notifications">Mark all as read</button>` : `<span>All caught up</span>`}</div>
      ${notifications.length ? `<div class="notification-list">${notifications.map((notification) => `<article class="notification-item ${notification.readAt ? "" : "notification-item--unread"}"><span class="notification-indicator" aria-hidden="true"></span><div class="notification-copy"><h3>${escapeHtml(notification.title)}</h3><p>${escapeHtml(notification.body)}</p><time>${escapeHtml(new Date(`${notification.createdAt.replace(" ", "T")}Z`).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }))}</time><button class="notification-open" data-action="open-notification" data-id="${notification.id}" data-listing-id="${notification.listingId}">View listing ${icon("arrow", 14)}</button></div>${notification.readAt ? "" : `<button class="notification-mark-read" data-action="mark-notification-read" data-id="${notification.id}" aria-label="Mark as read">${icon("check", 15)}</button>`}</article>`).join("")}</div>` : `<div class="notification-empty"><span>${icon("bell", 21)}</span><h3>No alerts yet</h3><p>When a grower posts a new listing in your county, it will show up here.</p></div>`}
    </section>`);
  }
  if (state.modal.type === "article") {
    const article = fieldArticles.find((item) => item.id === state.modal.articleId);
    if (!article) return "";
    return backdrop(`<article class="modal article-modal" role="dialog" aria-modal="true" aria-labelledby="article-title"><button class="close-button" data-action="close" aria-label="Close">${icon("x", 22)}</button>
      <span class="article-icon">${icon("book", 21)}</span><div class="article-meta"><span>${escapeHtml(article.category)}</span><span>${escapeHtml(article.readTime)}</span></div><h2 id="article-title">${escapeHtml(article.title)}</h2><p class="article-intro">${escapeHtml(article.excerpt)}</p>
      <div class="article-body">${article.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</div><button class="button button--outline article-close" data-action="close">Back to field notes</button></article>`);
  }
  return "";
}

function render() {
  const active = document.activeElement;
  const focusName = active?.getAttribute("data-field") || active?.name;
  const selectionStart = active && typeof active.selectionStart === "number" ? active.selectionStart : null;
  const formData = new Map();
  if (state.locationMapFrame !== null) {
    cancelAnimationFrame(state.locationMapFrame);
    state.locationMapFrame = null;
  }
  if (state.locationMap) {
    state.locationMap.remove();
    state.locationMap = null;
    state.locationMarker = null;
  }
  root.querySelectorAll("form").forEach((form) => {
    if (!form.dataset.form) return;
    formData.set(form.dataset.form, Array.from(new FormData(form).entries()).filter(([key, value]) => key !== "image" && typeof value === "string"));
  });
  root.innerHTML = renderPage();
  for (const [formName, entries] of formData) {
    const form = root.querySelector(`[data-form="${formName}"]`);
    if (!form) continue;
    for (const [name, value] of entries) {
      const field = form.elements.namedItem(name);
      if (!field || field.type === "file" || field.type === "radio" || ["county", "locality", "latitude", "longitude"].includes(name)) continue;
      field.value = value;
    }
  }
  if (focusName) {
    const target = root.querySelector(`[data-field="${focusName}"], [name="${focusName}"]`);
    if (target) {
      target.focus({ preventScroll: true });
      if (selectionStart !== null && target.setSelectionRange) target.setSelectionRange(selectionStart, selectionStart);
    }
  }
  initializeLocationMap();
  renderToast();
}

function renderNotificationBadge() {
  const button = root.querySelector('[data-action="notifications"]');
  if (!button) return;
  button.setAttribute("aria-label", `Notifications${state.unreadNotificationCount ? `, ${state.unreadNotificationCount} unread` : ""}`);
  const existingCount = button.querySelector(".notification-count");
  if (state.unreadNotificationCount && existingCount) {
    existingCount.textContent = state.unreadNotificationCount > 99 ? "99+" : String(state.unreadNotificationCount);
  } else if (state.unreadNotificationCount) {
    button.insertAdjacentHTML("beforeend", `<span class="notification-count">${state.unreadNotificationCount > 99 ? "99+" : state.unreadNotificationCount}</span>`);
  } else {
    existingCount?.remove();
  }
}

async function refreshNotifications(renderInbox = false) {
  if (!state.user) return;
  try {
    const data = await request(`/api/${state.market.crop}/notifications`);
    state.notifications = data.notifications || [];
    state.unreadNotificationCount = data.unreadCount || 0;
    renderNotificationBadge();
    if (renderInbox && state.modal?.type === "notifications") render();
  } catch (error) {
    if (error.message.includes("Sign in")) {
      state.user = null;
      state.notifications = [];
      state.unreadNotificationCount = 0;
      render();
    }
  }
}

async function loadMarket() {
  state.loading = true;
  render();
  try {
    const [marketData, listingsData, sessionData] = await Promise.all([
      request("/api/crops"),
      request(`/api/${state.market.crop}/listings`),
      request(`/api/${state.market.crop}/auth/session`),
    ]);
    state.crops = marketData.crops || defaultCrops;
    state.counties = marketData.counties || [];
    state.listings = listingsData.listings || [];
    state.user = sessionData.user || null;
    state.notifications = [];
    state.unreadNotificationCount = 0;
    if (state.user) await refreshNotifications();
  } catch (error) {
    notify(`Could not connect to this crop marketplace. ${error.message}`);
  } finally {
    state.loading = false;
    render();
  }
}

function setModal(type, extra = {}) {
  state.modal = { type, ...extra };
  render();
}

function openPost() {
  if (state.market.role !== "seller") {
    state.selectedRole = "seller";
    setModal("onboarding", { afterChoice: "post" });
  } else if (!state.user) {
    state.authMode = "signup";
    setModal("auth", { afterLogin: "post" });
  } else {
    state.listingKind = cropInfo().standingLabel;
    state.mapPin = null;
    state.postCounty = "";
    state.postLocality = "";
    state.locationResults = [];
    setModal("post");
  }
}

async function confirmContext() {
  const next = { crop: state.selectedCrop, role: state.selectedRole };
  if (state.user && next.crop === state.market.crop && state.user.role !== next.role) {
    try {
      const data = await request(`/api/${state.market.crop}/auth/role`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: next.role }),
      });
      state.user = data.user;
    } catch (error) {
      notify(error.message);
      return;
    }
  }
  const previousCrop = state.market.crop;
  localStorage.setItem(contextKey, JSON.stringify(next));
  state.market = next;
  state.search = "";
  state.place = "Everywhere";
  state.deal = "All land";
  state.showSaved = false;
  state.minAcres = 0;
  if (next.crop !== previousCrop) state.user = null;
  if (state.modal.afterChoice === "post") {
    if (state.user && next.crop === previousCrop) {
      state.listingKind = cropInfo().standingLabel;
      setModal("post");
    } else {
      state.authMode = "signup";
      setModal("auth", { afterLogin: "post" });
    }
  } else if (state.modal.afterChoice === "auth") {
    state.authMode = "signup";
    setModal("auth");
  } else {
    state.modal = null;
    render();
  }
  if (next.crop !== previousCrop) loadMarket();
}

async function submitAuth(form) {
  const formData = new FormData(form);
  try {
    const data = await request(`/api/${state.market.crop}/auth/${state.authMode}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: formData.get("phone"),
        password: formData.get("password"),
        ...(state.authMode === "signup"
          ? { role: state.market.role }
          : { rememberMe: formData.get("rememberMe") === "on" }),
      }),
    });
    let user = data.user;
    if (user.role !== state.market.role) {
      const roleData = await request(`/api/${state.market.crop}/auth/role`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: state.market.role }),
      });
      user = roleData.user;
    }
    state.user = user;
    await refreshNotifications();
    const afterLogin = state.modal.afterLogin;
    state.modal = afterLogin === "post" && user.role === "seller" ? { type: "post" } : null;
    render();
    if (afterLogin === "contact" && state.selected) await contactGrower();
    else notify(state.authMode === "signup" ? "Your crop marketplace account is ready." : "Welcome back.");
  } catch (error) {
    notify(error.message);
  }
}

async function submitProfile(form) {
  const formData = new FormData(form);
  try {
    const data = await request(`/api/${state.market.crop}/auth/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: formData.get("displayName"),
        county: formData.get("county"),
        bio: formData.get("bio"),
        listingNotificationsEnabled: formData.get("listingNotificationsEnabled") === "on",
      }),
    });
    state.user = data.user;
    state.notificationPreferenceDraft = null;
    state.modal = null;
    render();
    notify("Your profile has been updated.");
  } catch (error) {
    notify(error.message);
  }
}

async function submitListing(form) {
  const formData = new FormData(form);
  formData.set("kind", state.listingKind);
  try {
    const data = await request(`/api/${state.market.crop}/listings`, { method: "POST", body: formData });
    state.user.listingCredits = data.listingCredits;
    state.listings.unshift(data.listing);
    state.place = "Everywhere";
    state.deal = "All land";
    state.search = "";
    state.showSaved = false;
    state.minAcres = 0;
    state.sort = "Recommended";
    state.modal = null;
    state.mapPin = null;
    state.locationResults = [];
    render();
    notify(`Your sugarcane listing is live.`);
  } catch (error) {
    notify(error.message);
  }
}

async function signOut() {
  try {
    await request(`/api/${state.market.crop}/auth/logout`, { method: "POST" });
    state.user = null;
    state.notifications = [];
    state.unreadNotificationCount = 0;
    state.modal = null;
    render();
    notify("You are signed out.");
  } catch (error) {
    notify(error.message);
  }
}

function toggleSaved(id) {
  const current = savedForCrop();
  state.saved[state.market.crop] = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
  localStorage.setItem(savedKey, JSON.stringify(state.saved));
  render();
}

function openListing(id) {
  state.selected = state.listings.find((listing) => listing.id === Number(id)) || null;
  state.contactPhone = "";
  state.contactLocation = null;
  setModal("details");
}

async function contactGrower() {
  if (!state.user) {
    state.authMode = "login";
    setModal("auth", { afterLogin: "contact" });
    return;
  }
  try {
    const data = await request(`/api/${state.market.crop}/listings/${state.selected.id}/contact`);
    state.contactPhone = data.phone;
    state.contactLocation = { latitude: data.latitude, longitude: data.longitude };
    render();
  } catch (error) {
    if (error.paymentRequired) {
      state.paymentFlow = { purpose: "buyer_listing_reveal", listingId: state.selected.id, phone: state.user.phone, status: "ready", returnTo: "details" };
      setModal("payment");
      return;
    }
    notify(error.message);
  }
}

async function finishPaidFlow(flow) {
  state.paymentFlow = null;
  if (flow.purpose === "seller_listing_credit") {
    const data = await request(`/api/${state.market.crop}/auth/session`);
    state.user = data.user;
    state.modal = { type: "post" };
    render();
    notify("Payment confirmed. Your listing credit is ready.");
    return;
  }
  const data = await request(`/api/${state.market.crop}/listings/${flow.listingId}/contact`);
  state.contactPhone = data.phone;
  state.contactLocation = { latitude: data.latitude, longitude: data.longitude };
  state.modal = { type: "details" };
  render();
  notify("Payment confirmed. Grower contact details are unlocked.");
}

async function pollPayment(paymentId, flow = state.paymentFlow) {
  if (!flow) return;
  flow.paymentId = paymentId;
  flow.status = "waiting";
  render();
  for (let attempt = 0; attempt < 18; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
      const data = await request(`/api/${state.market.crop}/payments/${paymentId}`);
      if (data.payment.status === "confirmed") {
        await finishPaidFlow(flow);
        return;
      }
      if (["failed", "expired"].includes(data.payment.status)) {
        flow.status = "failed";
        render();
        notify("M-Pesa payment was not completed. You can try again.");
        return;
      }
    } catch (error) {
      notify(error.message);
      break;
    }
  }
  flow.status = "pending";
  render();
  notify("Payment is still processing. Check its status again before retrying.");
}

async function submitPayment(form) {
  const flow = state.paymentFlow;
  if (!flow) return;
  flow.phone = new FormData(form).get("phone");
  flow.status = "starting";
  render();
  try {
    const data = await request(`/api/${state.market.crop}/payments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purpose: flow.purpose, listingId: flow.listingId, phone: flow.phone,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    if (data.alreadyUnlocked) {
      await finishPaidFlow(flow);
      return;
    }
    await pollPayment(data.payment.id, flow);
  } catch (error) {
    flow.status = "failed";
    render();
    notify(error.message);
  }
}

function initializeLocationMap() {
  const element = document.querySelector("#listing-location-map");
  if (!element || !window.L) return;
  const pinned = state.mapPin && Number.isFinite(Number(state.mapPin.latitude)) && Number.isFinite(Number(state.mapPin.longitude));
  const center = pinned ? [Number(state.mapPin.latitude), Number(state.mapPin.longitude)] : [-0.65, 37.9];
  const map = window.L.map(element, {
    maxBounds: [[-4.8, 33.8], [5.2, 42.2]],
    maxBoundsViscosity: 0.85,
    scrollWheelZoom: false,
  }).setView(center, pinned ? 13 : 6);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
  }).addTo(map);
  state.locationMap = map;
  if (pinned) state.locationMarker = window.L.marker(center).addTo(map);
  map.on("click", (event) => selectMapPoint(event.latlng));
  state.locationMapFrame = requestAnimationFrame(() => {
    state.locationMapFrame = null;
    if (state.locationMap === map && element.isConnected) map.invalidateSize({ pan: false });
  });
}

async function selectMapPoint(point) {
  if (state.locationLoading) return;
  const latitude = Number(point.lat.toFixed(6));
  const longitude = Number(point.lng.toFixed(6));
  state.locationLoading = true;
  state.mapPin = { latitude, longitude, displayName: "Finding nearby place…" };
  render();
  try {
    const data = await request(`/api/location/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`);
    state.postCounty = data.location.county;
    state.postLocality = data.location.locality;
    state.mapPin = data.location;
    state.locationResults = [];
    notify(`Map pin set near ${data.location.locality}, ${data.location.county}.`);
  } catch (error) {
    state.mapPin.displayName = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    notify(`${error.message} Your pin is saved; enter the county and town manually.`);
  } finally {
    state.locationLoading = false;
    render();
  }
}

function applyLocation(location) {
  if (!location) return;
  state.postCounty = location.county;
  state.postLocality = location.locality;
  state.mapPin = location;
  state.locationResults = [];
  render();
  notify(`Map pin set near ${location.locality}, ${location.county}.`);
}

async function searchLocation() {
  if (state.postLocality.trim().length < 3) {
    notify("Enter a town or area first, then search for its map location.");
    return;
  }
  state.locationLoading = true;
  render();
  try {
    const query = [state.postLocality.trim(), state.postCounty, "Kenya"].filter(Boolean).join(", ");
    const data = await request(`/api/location/search?q=${encodeURIComponent(query)}`);
    state.locationResults = data.results || [];
    if (!state.locationResults.length) notify("No matching Kenyan locations found. You can still post without a map pin.");
  } catch (error) {
    notify(error.message);
  } finally {
    state.locationLoading = false;
    render();
  }
}

function useDeviceLocation() {
  if (!navigator.geolocation) {
    notify("Device location is not available in this browser. Search by town or area instead.");
    return;
  }
  state.locationLoading = true;
  render();
  navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    try {
      const data = await request(`/api/location/reverse?lat=${encodeURIComponent(coords.latitude)}&lon=${encodeURIComponent(coords.longitude)}`);
      applyLocation(data.location);
    } catch (error) {
      notify(error.message);
    } finally {
      state.locationLoading = false;
      render();
    }
  }, (error) => {
    state.locationLoading = false;
    render();
    notify(error.code === error.PERMISSION_DENIED ? "Allow location access, or search by town or area instead." : "Could not get device location. Search by town or area instead.");
  }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
}

root.addEventListener("click", async (event) => {
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const action = control.dataset.action;
  if (action === "backdrop") {
    if (event.target === control && control.classList.contains("modal-backdrop") && !control.classList.contains("onboarding-backdrop")) {
      state.modal = null;
      render();
    }
  } else if (action === "close") {
    state.modal = null;
    render();
  } else if (action === "context") {
    state.selectedCrop = state.market.crop;
    state.selectedRole = state.market.role;
    setModal("onboarding");
  } else if (action === "role") {
    state.selectedRole = control.dataset.value;
    render();
  } else if (action === "confirm-context") {
    await confirmContext();
  } else if (action === "post") {
    openPost();
  } else if (action === "listing-credit") {
    state.paymentFlow = { purpose: "seller_listing_credit", phone: state.user?.phone || "", status: "ready", returnTo: "post" };
    setModal("payment");
  } else if (action === "check-payment") {
    if (state.paymentFlow?.paymentId) await pollPayment(state.paymentFlow.paymentId, state.paymentFlow);
  } else if (action === "login") {
    state.authMode = "login";
    setModal("auth");
  } else if (action === "profile") {
    if (state.user) {
      state.notificationPreferenceDraft = Boolean(state.user.listingNotificationsEnabled);
      setModal("profile");
    }
  } else if (action === "notifications") {
    if (state.user) {
      state.modal = { type: "notifications" };
      render();
      await refreshNotifications(true);
    }
  } else if (action === "mark-notification-read") {
    try {
      await request(`/api/${state.market.crop}/notifications/${control.dataset.id}/read`, { method: "POST" });
      await refreshNotifications(true);
    } catch (error) {
      notify(error.message);
    }
  } else if (action === "mark-all-notifications") {
    try {
      await request(`/api/${state.market.crop}/notifications/read-all`, { method: "POST" });
      await refreshNotifications(true);
    } catch (error) {
      notify(error.message);
    }
  } else if (action === "open-notification") {
    const listingId = Number(control.dataset.listingId);
    try {
      await request(`/api/${state.market.crop}/notifications/${control.dataset.id}/read`, { method: "POST" });
      await refreshNotifications();
      if (!state.listings.some((listing) => listing.id === listingId)) {
        const data = await request(`/api/${state.market.crop}/listings`);
        state.listings = data.listings || [];
      }
      if (!state.listings.some((listing) => listing.id === listingId)) {
        state.modal = null;
        render();
        notify("That listing is no longer available.");
        return;
      }
      openListing(listingId);
    } catch (error) {
      notify(error.message);
    }
  } else if (action === "toggle-auth") {
    state.authMode = state.authMode === "signup" ? "login" : "signup";
    render();
  } else if (action === "signout") {
    await signOut();
  } else if (action === "toggle-saved") {
    state.showSaved = !state.showSaved;
    state.deal = "All land";
    render();
  } else if (action === "all-listings") {
    state.showSaved = false;
    render();
  } else if (action === "save") {
    toggleSaved(Number(control.dataset.id));
  } else if (action === "details") {
    openListing(control.dataset.id);
  } else if (action === "read-article") {
    setModal("article", { articleId: control.dataset.id });
  } else if (action === "deal") {
    state.deal = control.dataset.value;
    render();
  } else if (action === "filters") {
    setModal("filters");
  } else if (action === "menu") {
    setModal("menu");
  } else if (action === "contact") {
    await contactGrower();
  } else if (action === "search-location") {
    await searchLocation();
  } else if (action === "device-location") {
    useDeviceLocation();
  } else if (action === "apply-location") {
    applyLocation(state.locationResults[Number(control.dataset.index)]);
  } else if (action === "clear-pin") {
    state.mapPin = null;
    render();
  }
});

root.addEventListener("input", (event) => {
  const field = event.target.dataset.field;
  if (field === "search") state.search = event.target.value;
  if (field === "min-acres") state.minAcres = Number(event.target.value) || 0;
  if (field === "locality") {
    state.postLocality = event.target.value;
    state.mapPin = null;
    state.locationResults = [];
    if (state.locationMarker && state.locationMap) state.locationMap.removeLayer(state.locationMarker);
    state.locationMarker = null;
    root.querySelector(".map-pin-status")?.remove();
    root.querySelector(".location-results")?.remove();
    const form = root.querySelector('[data-form="listing"]');
    if (form) {
      form.elements.namedItem("latitude").value = "";
      form.elements.namedItem("longitude").value = "";
    }
    const hint = root.querySelector(".location-map-hint");
    if (hint) hint.textContent = "Tap the map to drop a pin";
  }
  if (field === "min-acres" || field === "search") render();
});

root.addEventListener("change", (event) => {
  const field = event.target.dataset.field;
  if (event.target.name === "listingNotificationsEnabled") {
    state.notificationPreferenceDraft = event.target.checked;
  }
  if (event.target.name === "county" && event.target.form?.dataset.form === "profile") {
    const preference = event.target.form.elements.namedItem("listingNotificationsEnabled");
    if (!event.target.value) {
      preference.checked = false;
      preference.disabled = true;
      state.notificationPreferenceDraft = false;
    } else {
      preference.disabled = false;
    }
    const note = preference.closest("label").querySelector("small");
    note.textContent = event.target.value ? `Get an in-app notification when someone posts in ${event.target.value}.` : "Choose your county above to turn this on.";
  }
  if (field === "selected-crop") {
    state.selectedCrop = event.target.value;
    render();
  }
  if (field === "show-saved") {
    state.showSaved = event.target.checked;
    render();
  } else if (field === "place") {
    state.place = event.target.value;
    render();
  } else if (field === "sort") {
    state.sort = event.target.value;
    render();
  } else if (field === "county") {
    state.postCounty = event.target.value;
    state.mapPin = null;
    state.locationResults = [];
    render();
  } else if (event.target.name === "kind") {
    state.listingKind = event.target.value;
    render();
  }
});

root.addEventListener("submit", async (event) => {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  if (form.dataset.form === "auth") await submitAuth(form);
  if (form.dataset.form === "profile") await submitProfile(form);
  if (form.dataset.form === "listing") await submitListing(form);
  if (form.dataset.form === "payment") await submitPayment(form);
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    root.querySelector('[data-field="search"]')?.focus();
  }
  if (event.key === "Escape" && state.modal && state.modal.type !== "onboarding") {
    state.modal = null;
    render();
  }
});
loadMarket();
setInterval(() => {
  if (state.user && !document.hidden) refreshNotifications(state.modal?.type === "notifications");
}, 60_000);
