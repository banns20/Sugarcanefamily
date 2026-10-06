import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownUp,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Heart,
  Leaf,
  MapPin,
  Menu,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import "./style.css";
import "./kenya-style.css";

const cropDefaults = [
  {
    id: "sugarcane",
    name: "Sugarcane",
    standingLabel: "Standing sugarcane",
    fieldLabel: "Sugarcane variety",
  },
  {
    id: "maize",
    name: "Maize",
    standingLabel: "Standing maize",
    fieldLabel: "Maize variety",
  },
  {
    id: "beans",
    name: "Beans",
    standingLabel: "Standing beans",
    fieldLabel: "Bean variety",
  },
  {
    id: "rice",
    name: "Rice",
    standingLabel: "Standing rice",
    fieldLabel: "Rice variety",
  },
  {
    id: "potatoes",
    name: "Potatoes",
    standingLabel: "Standing potato crop",
    fieldLabel: "Potato variety",
  },
  {
    id: "coffee",
    name: "Coffee",
    standingLabel: "Standing coffee",
    fieldLabel: "Coffee variety",
  },
  {
    id: "tea",
    name: "Tea",
    standingLabel: "Standing tea",
    fieldLabel: "Tea variety",
  },
  {
    id: "avocado",
    name: "Avocado",
    standingLabel: "Standing avocado",
    fieldLabel: "Avocado variety",
  },
];
const counties = [
  "Baringo",
  "Bomet",
  "Bungoma",
  "Busia",
  "Elgeyo-Marakwet",
  "Embu",
  "Garissa",
  "Homa Bay",
  "Isiolo",
  "Kajiado",
  "Kakamega",
  "Kericho",
  "Kiambu",
  "Kilifi",
  "Kirinyaga",
  "Kisii",
  "Kisumu",
  "Kitui",
  "Kwale",
  "Laikipia",
  "Lamu",
  "Machakos",
  "Makueni",
  "Mandera",
  "Marsabit",
  "Meru",
  "Migori",
  "Mombasa",
  "Murang'a",
  "Nairobi",
  "Nakuru",
  "Nandi",
  "Narok",
  "Nyamira",
  "Nyandarua",
  "Nyeri",
  "Samburu",
  "Siaya",
  "Taita-Taveta",
  "Tana River",
  "Tharaka-Nithi",
  "Trans Nzoia",
  "Turkana",
  "Uasin Gishu",
  "Vihiga",
  "Wajir",
  "West Pokot",
  "Other",
];
const money = (amount) => `KSh ${Number(amount).toLocaleString("en-KE")}`;
const imageUrl = (image) =>
  image?.startsWith("http")
    ? image
    : image ||
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=82";

function readMarketContext() {
  try {
    const saved = JSON.parse(localStorage.getItem("mavuno-market-context"));
    if (
      cropDefaults.some((crop) => crop.id === saved?.crop) &&
      ["buyer", "seller"].includes(saved?.role)
    )
      return saved;
  } catch {
    return null;
  }
  return null;
}

function ListingCard({ listing, saved, standingLabel, onSave, onOpen }) {
  const isStanding = listing.kind === standingLabel;
  return (
    <article className="listing-card">
      <button
        className="listing-photo"
        onClick={() => onOpen(listing)}
        aria-label={`View ${listing.title}`}
      >
        <img
          src={imageUrl(listing.image)}
          alt={`${listing.kind} in ${listing.locality}, ${listing.county}`}
          loading="lazy"
        />
        <span className={`deal-tag ${isStanding ? "deal-tag--harvest" : ""}`}>
          {listing.kind}
        </span>
        <span className="photo-caption">
          <Sparkles size={13} /> {listing.tag}
        </span>
      </button>
      <button
        className={`save-button ${saved ? "is-saved" : ""}`}
        onClick={() => onSave(listing.id)}
        aria-label={saved ? "Remove from saved" : "Save listing"}
        aria-pressed={saved}
      >
        <Heart size={18} fill={saved ? "currentColor" : "none"} />
      </button>
      <div className="listing-content">
        <div className="listing-title-row">
          <h3>{listing.title}</h3>
          <span className="posted-time">{listing.posted}</span>
        </div>
        <p className="listing-location">
          <MapPin size={14} /> {listing.district}
        </p>
        <div className="listing-facts">
          <span>
            <strong>{listing.acres}</strong> acres
          </span>
          <span className="fact-divider" />
          <span>{listing.crop}</span>
        </div>
        <div className="listing-footer">
          <div className="price-block">
            <strong>{money(listing.rate)}</strong>
            <span>{isStanding ? " / acre · crop" : " / acre · year"}</span>
          </div>
          <button
            className="text-link"
            onClick={() => onOpen(listing)}
            aria-label={`See details for ${listing.title}`}
          >
            Details <ArrowRight size={15} />
          </button>
        </div>
        <div className="seller-line">
          <span className="seller-avatar">
            {listing.verified ? <Check size={12} /> : <Leaf size={12} />}
          </span>
          <span>{listing.seller}</span>
          {listing.verified && (
            <span className="verified-mark" title="Mavuno member">
              <Check size={11} />
            </span>
          )}
          {listing.verified && <small>Member</small>}
        </div>
      </div>
    </article>
  );
}

function App() {
  const initialContext = readMarketContext();
  const [marketContext, setMarketContext] = useState(initialContext);
  const [selectedCrop, setSelectedCrop] = useState(
    initialContext?.crop ?? "sugarcane",
  );
  const [selectedRole, setSelectedRole] = useState(
    initialContext?.role ?? "buyer",
  );
  const [cropOptions, setCropOptions] = useState(cropDefaults);
  const [listings, setListings] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [place, setPlace] = useState("Everywhere");
  const [deal, setDeal] = useState("All land");
  const [savedByCrop, setSavedByCrop] = useState({});
  const [showSaved, setShowSaved] = useState(false);
  const [minAcres, setMinAcres] = useState(0);
  const [modal, setModal] = useState(
    initialContext ? null : { type: "onboarding" },
  );
  const [selected, setSelected] = useState(null);
  const [sort, setSort] = useState("Recommended");
  const [toast, setToast] = useState("");
  const [authMode, setAuthMode] = useState("signup");
  const [listingKind, setListingKind] = useState("Standing sugarcane");
  const [contactPhone, setContactPhone] = useState("");
  const [mapPin, setMapPin] = useState(null);
  const [locationResults, setLocationResults] = useState([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const localityInputRef = useRef(null);
  const countySelectRef = useRef(null);

  const activeCrop = marketContext?.crop ?? "sugarcane";
  const activeRole = marketContext?.role ?? selectedRole;
  const cropInfo =
    cropOptions.find((crop) => crop.id === activeCrop) ?? cropDefaults[0];
  const saved = savedByCrop[activeCrop] ?? [];

  useEffect(() => {
    let cancelled = false;
    async function loadMarketplace() {
      setLoading(true);
      try {
        const [cropResponse, listingsResponse, sessionResponse] =
          await Promise.all([
            fetch("/api/crops"),
            fetch(`/api/${activeCrop}/listings`),
            fetch(`/api/${activeCrop}/auth/session`),
          ]);
        if (!cropResponse.ok || !listingsResponse.ok || !sessionResponse.ok)
          throw new Error("Marketplace request failed");
        const [cropData, listingsData, sessionData] = await Promise.all([
          cropResponse.json(),
          listingsResponse.json(),
          sessionResponse.json(),
        ]);
        if (cancelled) return;
        setCropOptions(cropData.crops ?? cropDefaults);
        setListings(listingsData.listings ?? []);
        setUser(sessionData.user ?? null);
      } catch {
        if (!cancelled)
          notify(
            "Could not connect to this crop marketplace. Please refresh to try again.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadMarketplace();
    return () => {
      cancelled = true;
    };
  }, [activeCrop]);

  useEffect(() => {
    setListingKind(cropInfo.standingLabel);
    setMapPin(null);
    setLocationResults([]);
    setSearch("");
    setPlace("Everywhere");
    setDeal("All land");
    setShowSaved(false);
    setMinAcres(0);
  }, [activeCrop, cropInfo.standingLabel]);

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return listings
      .filter((listing) => {
        const matchesQuery =
          !query ||
          `${listing.title} ${listing.district} ${listing.crop} ${listing.seller}`
            .toLowerCase()
            .includes(query);
        const matchesPlace = place === "Everywhere" || listing.county === place;
        const matchesDeal = deal === "All land" || listing.kind === deal;
        const matchesSaved = !showSaved || saved.includes(listing.id);
        return (
          matchesQuery &&
          matchesPlace &&
          matchesDeal &&
          matchesSaved &&
          listing.acres >= minAcres
        );
      })
      .sort((a, b) =>
        sort === "Price: low to high"
          ? a.rate - b.rate
          : sort === "Most acres"
            ? b.acres - a.acres
            : 0,
      );
  }, [deal, listings, minAcres, place, saved, search, showSaved, sort]);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  function openContextPicker(afterChoice = null) {
    setSelectedCrop(activeCrop);
    setSelectedRole(activeRole);
    setModal({ type: "onboarding", afterChoice });
  }

  function openPost() {
    if (activeRole !== "seller") {
      setSelectedRole("seller");
      setModal({ type: "onboarding", afterChoice: "post" });
      return;
    }
    if (user) {
      setMapPin(null);
      setLocationResults([]);
      setModal({ type: "post" });
      return;
    }
    setAuthMode("signup");
    setModal({ type: "auth", afterLogin: "post" });
  }

  function openAuth(mode = "login") {
    setAuthMode(mode);
    setModal({ type: "auth" });
  }

  async function confirmMarketContext() {
    const nextContext = { crop: selectedCrop, role: selectedRole };
    if (
      user &&
      nextContext.crop === activeCrop &&
      user.role !== nextContext.role
    ) {
      try {
        const response = await fetch(`/api/${activeCrop}/auth/role`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: nextContext.role }),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error || "Could not change your marketplace role.",
          );
        setUser(data.user);
      } catch (error) {
        notify(error.message);
        return;
      }
    }
    localStorage.setItem("mavuno-market-context", JSON.stringify(nextContext));
    if (nextContext.crop !== activeCrop) setUser(null);
    setMarketContext(nextContext);
    if (modal?.afterChoice === "post") {
      if (user && nextContext.crop === activeCrop) setModal({ type: "post" });
      else {
        setAuthMode("signup");
        setModal({ type: "auth", afterLogin: "post" });
      }
    } else if (modal?.afterChoice === "auth") {
      setAuthMode("signup");
      setModal({ type: "auth" });
    } else {
      setModal(null);
    }
  }

  function toggleSaved(id) {
    setSavedByCrop((current) => {
      const cropSaved = current[activeCrop] ?? [];
      const nextSaved = cropSaved.includes(id)
        ? cropSaved.filter((item) => item !== id)
        : [...cropSaved, id];
      return { ...current, [activeCrop]: nextSaved };
    });
  }

  async function submitAuth(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      phone: form.get("phone"),
      password: form.get("password"),
    };
    if (authMode === "signup") payload.role = activeRole;
    try {
      const response = await fetch(`/api/${activeCrop}/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not sign in.");
      let signedInUser = data.user;
      if (signedInUser.role !== activeRole) {
        const roleResponse = await fetch(`/api/${activeCrop}/auth/role`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: activeRole }),
        });
        const roleData = await roleResponse.json();
        if (!roleResponse.ok)
          throw new Error(
            roleData.error || "Could not change your marketplace role.",
          );
        signedInUser = roleData.user;
      }
      setUser(signedInUser);
      const goToPost = modal?.afterLogin === "post";
      const goToContact = modal?.afterLogin === "contact";
      setModal(
        goToPost && signedInUser.role === "seller" ? { type: "post" } : null,
      );
      if (goToContact && selected) {
        const contactResponse = await fetch(
          `/api/${activeCrop}/listings/${selected.id}/contact`,
        );
        const contactData = await contactResponse.json();
        if (contactResponse.ok) setContactPhone(contactData.phone);
        else notify(contactData.error || "Contact details are unavailable.");
      } else {
        notify(
          authMode === "signup"
            ? "Your crop marketplace account is ready."
            : "Welcome back.",
        );
      }
    } catch (error) {
      notify(error.message);
    }
  }

  async function signOut() {
    await fetch(`/api/${activeCrop}/auth/logout`, { method: "POST" });
    setUser(null);
    notify("You are signed out.");
  }

  async function submitListing(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("kind", listingKind);
    try {
      const response = await fetch(`/api/${activeCrop}/listings`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not publish this listing.");
      setListings((current) => [data.listing, ...current]);
      setPlace("Everywhere");
      setDeal("All land");
      setSearch("");
      setShowSaved(false);
      setMinAcres(0);
      setSort("Recommended");
      setMapPin(null);
      setLocationResults([]);
      setModal(null);
      notify(`Your ${cropInfo.name.toLowerCase()} listing is live.`);
    } catch (error) {
      notify(error.message);
    }
  }

  function applyLocation(location) {
    if (countySelectRef.current)
      countySelectRef.current.value = location.county;
    if (localityInputRef.current)
      localityInputRef.current.value = location.locality;
    setMapPin({
      latitude: location.latitude,
      longitude: location.longitude,
      displayName: location.displayName,
    });
    setLocationResults([]);
    notify(`Map pin set near ${location.locality}, ${location.county}.`);
  }

  async function searchLocation() {
    const locality = localityInputRef.current?.value.trim() ?? "";
    const county = countySelectRef.current?.value ?? "";
    const query = [locality, county, "Kenya"].filter(Boolean).join(", ");
    if (locality.length < 3) {
      notify("Enter a town or area first, then search for its map location.");
      return;
    }
    setLocationLoading(true);
    try {
      const response = await fetch(
        `/api/location/search?q=${encodeURIComponent(query)}`,
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not search this location.");
      setLocationResults(data.results ?? []);
      if (!data.results?.length)
        notify(
          "No matching Kenyan locations found. You can still post without a map pin.",
        );
    } catch (error) {
      notify(error.message);
    } finally {
      setLocationLoading(false);
    }
  }

  function useDeviceLocation() {
    if (!navigator.geolocation) {
      notify(
        "Device location is not available in this browser. Search by town or area instead.",
      );
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const response = await fetch(
            `/api/location/reverse?lat=${encodeURIComponent(coords.latitude)}&lon=${encodeURIComponent(coords.longitude)}`,
          );
          const data = await response.json();
          if (!response.ok)
            throw new Error(data.error || "Could not find this location.");
          applyLocation(data.location);
        } catch (error) {
          notify(error.message);
        } finally {
          setLocationLoading(false);
        }
      },
      (error) => {
        setLocationLoading(false);
        notify(
          error.code === error.PERMISSION_DENIED
            ? "Allow location access, or search by town or area instead."
            : "Could not get device location. Search by town or area instead.",
        );
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
  }

  async function contactGrower() {
    if (!user) {
      setAuthMode("login");
      setModal({ type: "auth", afterLogin: "contact" });
      return;
    }
    try {
      const response = await fetch(
        `/api/${activeCrop}/listings/${selected.id}/contact`,
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Contact details are unavailable.");
      setContactPhone(data.phone);
    } catch (error) {
      notify(error.message);
    }
  }

  function clearFilters() {
    setSearch("");
    setPlace("Everywhere");
    setDeal("All land");
    setShowSaved(false);
    setMinAcres(0);
  }

  const titleCrop = cropInfo.name.toLowerCase();

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Mavuno Market home">
          <span className="brand-mark">
            <Leaf size={20} strokeWidth={2.3} />
          </span>
          <span className="brand-name">
            mavuno<span>market</span>
          </span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a className="nav-active" href="#market">
            Marketplace
          </a>
          <a href="#how-it-works">How it works</a>
          <button className="context-nav" onClick={() => openContextPicker()}>
            {cropInfo.name} · {activeRole === "buyer" ? "Buyer" : "Seller"}{" "}
            <ChevronDown size={14} />
          </button>
        </nav>
        <div className="top-actions">
          <button
            className={`saved-nav ${showSaved ? "saved-nav--active" : ""}`}
            onClick={() => {
              setShowSaved(!showSaved);
              setDeal("All land");
            }}
          >
            <Heart size={17} fill={showSaved ? "currentColor" : "none"} />
            <span>Saved</span>
            {saved.length > 0 && <b>{saved.length}</b>}
          </button>
          {user && (
            <button className="account-nav" onClick={signOut} title="Sign out">
              {user.phone}
              <span>Sign out</span>
            </button>
          )}
          {!user && (
            <button className="signin-nav" onClick={() => openAuth("login")}>
              Sign in
            </button>
          )}
          {activeRole === "seller" && (
            <button
              className="button button--green button--nav"
              onClick={openPost}
            >
              <Plus size={17} /> Post a listing
            </button>
          )}
          <button
            className="mobile-menu"
            aria-label="Open menu"
            onClick={() => setModal({ type: "menu" })}
          >
            <Menu />
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div
            className="hero-image"
            role="img"
            aria-label="Sunlit Kenyan farmland"
          />
          <div className="hero-content">
            <div className="eyebrow">
              <span className="eyebrow-line" /> KENYA'S{" "}
              {cropInfo.name.toUpperCase()} MARKETPLACE
            </div>
            <h1>
              Good ground.
              <br />
              <em>Good growing.</em>
            </h1>
            <p>
              Find {titleCrop} already growing, or lease the right land to plant
              your next crop.
            </p>
            <a className="hero-link" href="#market">
              Explore {titleCrop} listings <ArrowRight size={17} />
            </a>
          </div>
          <div className="hero-note">
            <span className="note-icon">
              <Leaf size={17} />
            </span>
            <span>
              <strong>Rooted in Kenya</strong>
              <small>Made for local growers</small>
            </span>
          </div>
          <div className="hero-count">
            <strong>{listings.length}</strong>
            <span>
              {cropInfo.name.toLowerCase()} plots
              <br />
              ready to grow
            </span>
          </div>
          <span className="hero-sun sun-one" />
          <span className="hero-sun sun-two" />
        </section>

        <section className="market section-wrap" id="market">
          <div className="section-heading">
            <div>
              <div className="eyebrow eyebrow--dark">
                <span className="eyebrow-line" /> {cropInfo.name.toUpperCase()}{" "}
                MARKETPLACE
              </div>
              <h2>
                Find your <em>patch.</em>
              </h2>
              <p>Browse {titleCrop} already growing or land ready to plant.</p>
            </div>
            <div className="market-aside">
              <span className="live-dot" />{" "}
              <strong>{listings.length} open listings</strong>
              <span>for {titleCrop}</span>
            </div>
          </div>

          <div className="search-bar">
            <label className="search-input-wrap">
              <Search size={19} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Try a town, county, or grower"
                aria-label="Search listings"
              />
              <kbd>⌘ K</kbd>
            </label>
            <label className="select-wrap">
              <MapPin size={17} />
              <select
                value={place}
                onChange={(event) => setPlace(event.target.value)}
                aria-label="Filter by county"
              >
                <option>Everywhere</option>
                {counties.map((county) => (
                  <option key={county}>{county}</option>
                ))}
              </select>
              <ChevronDown size={15} />
            </label>
            <button
              className="filter-button"
              onClick={() => setModal({ type: "filters" })}
            >
              <SlidersHorizontal size={17} />
              <span>Filters</span>
            </button>
          </div>

          <div className="market-controls">
            <div className="deal-tabs" role="tablist" aria-label="Listing type">
              {["All land", cropInfo.standingLabel, "Land for lease"].map(
                (option) => (
                  <button
                    key={option}
                    role="tab"
                    aria-selected={deal === option}
                    className={deal === option ? "tab-active" : ""}
                    onClick={() => setDeal(option)}
                  >
                    {option}
                    <span>
                      {option === "All land"
                        ? listings.length
                        : listings.filter((listing) => listing.kind === option)
                            .length}
                    </span>
                  </button>
                ),
              )}
            </div>
            <div className="sort-wrap">
              <ArrowDownUp size={15} />
              <label htmlFor="sort-listings">Sort:</label>
              <select
                id="sort-listings"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option>Recommended</option>
                <option>Price: low to high</option>
                <option>Most acres</option>
              </select>
              <ChevronDown size={14} />
            </div>
          </div>

          {showSaved && (
            <div className="saved-banner">
              <Heart size={16} fill="currentColor" /> Showing your saved
              listings{" "}
              <button onClick={() => setShowSaved(false)}>
                Show all land <ArrowRight size={14} />
              </button>
            </div>
          )}

          {loading ? (
            <div className="empty-state">
              <span>
                <Leaf size={22} />
              </span>
              <h3>Finding good ground...</h3>
              <p>Loading the {titleCrop} marketplace.</p>
            </div>
          ) : filteredListings.length ? (
            <div className="listing-grid">
              {filteredListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  saved={saved.includes(listing.id)}
                  standingLabel={cropInfo.standingLabel}
                  onSave={toggleSaved}
                  onOpen={(item) => {
                    setSelected(item);
                    setContactPhone("");
                    setModal({ type: "details" });
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span>
                <Search size={22} />
              </span>
              <h3>No {titleCrop} listings yet</h3>
              <p>
                {activeRole === "seller"
                  ? "Be the first to share a crop or land listing in this marketplace."
                  : "Try another county, or switch crops to explore another marketplace."}
              </p>
              {activeRole === "seller" ? (
                <button className="button button--green" onClick={openPost}>
                  <Plus size={16} /> Post the first listing
                </button>
              ) : (
                <button
                  className="button button--green"
                  onClick={() => openContextPicker()}
                >
                  Choose another crop
                </button>
              )}
            </div>
          )}
          <div className="browse-footer">
            <span>
              Showing <strong>{filteredListings.length}</strong> of{" "}
              <strong>{listings.length}</strong> {titleCrop} listings
            </span>
            {activeRole === "seller" ? (
              <button className="button button--outline" onClick={openPost}>
                Have {titleCrop} to share? <strong>Post it here</strong>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                className="button button--outline"
                onClick={() => openContextPicker()}
              >
                Switch crop or mode <strong>Choose</strong>
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </section>

        <section className="grower-strip" id="how-it-works">
          <div className="grower-strip-inner">
            <div className="grower-stamp">
              <Leaf size={27} />
              <span>
                GROW
                <br />
                TOGETHER
              </span>
            </div>
            <div>
              <div className="eyebrow eyebrow--light">
                <span className="eyebrow-line" /> A BETTER WAY TO GROW
              </div>
              <h2>
                Land brings us
                <br />
                <em>together.</em>
              </h2>
            </div>
            <p>
              See the crop or land clearly, agree on terms directly, and connect
              with growers across Kenya.
            </p>
            <a href="#market" className="strip-link">
              Find your next opportunity <ArrowRight size={17} />
            </a>
          </div>
          <span className="strip-leaf leaf-a">
            <Leaf />
          </span>
          <span className="strip-leaf leaf-b">
            <Leaf />
          </span>
        </section>

        <section className="bottom-note section-wrap" id="grower-notes">
          <div>
            <span className="note-spark">✳</span>
            <span>Better growing starts with a conversation.</span>
          </div>
          <a href="mailto:hello@mavunomarket.ke">
            Questions? Talk to our team <ArrowRight size={15} />
          </a>
        </section>
      </main>

      <footer className="footer">
        <a className="brand brand--footer" href="#top">
          <span className="brand-mark">
            <Leaf size={17} />
          </span>
          <span className="brand-name">
            mavuno<span>market</span>
          </span>
        </a>
        <span>For the people who grow what we all need.</span>
        <span>Kenya · KSh</span>
      </footer>

      {modal?.type === "onboarding" && (
        <div className="modal-backdrop onboarding-backdrop">
          <section
            className="modal onboarding-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
          >
            <div className="onboarding-mark">
              <Leaf size={20} />
            </div>
            <span className="eyebrow eyebrow--dark">
              <span className="eyebrow-line" /> YOUR LOCAL CROP MARKET
            </span>
            <h2 id="onboarding-title">
              First, choose your <em>market.</em>
            </h2>
            <p className="onboarding-intro">
              Each crop has its own listings, accounts, and database.
            </p>
            <label className="onboarding-label" htmlFor="choose-crop">
              Which crop are you here for?
            </label>
            <select
              id="choose-crop"
              className="onboarding-select"
              value={selectedCrop}
              onChange={(event) => setSelectedCrop(event.target.value)}
            >
              {cropOptions.map((crop) => (
                <option key={crop.id} value={crop.id}>
                  {crop.name}
                </option>
              ))}
            </select>
            <span className="onboarding-label">
              How would you like to use this marketplace?
            </span>
            <div className="role-choices">
              <button
                className={
                  selectedRole === "buyer"
                    ? "role-choice role-choice--active"
                    : "role-choice"
                }
                onClick={() => setSelectedRole("buyer")}
              >
                <Search size={19} />
                <span>
                  <strong>Buyer</strong>
                  <small>Browse crops and contact sellers</small>
                </span>
                {selectedRole === "buyer" && <Check size={16} />}
              </button>
              <button
                className={
                  selectedRole === "seller"
                    ? "role-choice role-choice--active"
                    : "role-choice"
                }
                onClick={() => setSelectedRole("seller")}
              >
                <Plus size={19} />
                <span>
                  <strong>Seller</strong>
                  <small>Post crops or land for lease</small>
                </span>
                {selectedRole === "seller" && <Check size={16} />}
              </button>
            </div>
            <button
              className="button button--green onboarding-submit"
              onClick={confirmMarketContext}
            >
              Enter{" "}
              {cropOptions.find((crop) => crop.id === selectedCrop)?.name ??
                "market"}{" "}
              market <ArrowRight size={17} />
            </button>
            <small className="onboarding-footnote">
              You can switch your crop or buyer/seller mode any time.
            </small>
          </section>
        </div>
      )}

      {modal?.type === "auth" && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(null);
          }}
        >
          <section
            className="modal auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow eyebrow--dark">
                  <span className="eyebrow-line" />{" "}
                  {cropInfo.name.toUpperCase()} · {activeRole.toUpperCase()}
                </span>
                <h2 id="auth-title">
                  {authMode === "signup" ? (
                    <>
                      Join the <em>market.</em>
                    </>
                  ) : (
                    <>
                      Welcome <em>back.</em>
                    </>
                  )}
                </h2>
                <p>
                  Create a {activeRole} account for the{" "}
                  {cropInfo.name.toLowerCase()} marketplace.
                </p>
              </div>
              <button
                className="close-button"
                onClick={() => setModal(null)}
                aria-label="Close"
              >
                <X />
              </button>
            </div>
            <form className="auth-form" onSubmit={submitAuth}>
              <label>
                Kenyan mobile number
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="0712 345 678"
                  required
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    authMode === "signup" ? "new-password" : "current-password"
                  }
                  minLength="8"
                  maxLength="128"
                  placeholder="At least 8 characters"
                  required
                />
              </label>
              <button
                className="button button--green form-submit"
                type="submit"
              >
                {authMode === "signup" ? "Create account" : "Sign in"}{" "}
                <ArrowRight size={16} />
              </button>
            </form>
            <p className="auth-switch">
              {authMode === "signup"
                ? "Already have an account?"
                : "New to this crop market?"}{" "}
              <button
                onClick={() =>
                  setAuthMode(authMode === "signup" ? "login" : "signup")
                }
              >
                {authMode === "signup" ? "Sign in" : "Create an account"}
              </button>
            </p>
            <p className="form-footnote">
              <CircleHelp size={14} /> Your account is separate from other crop
              marketplaces.
            </p>
          </section>
        </div>
      )}

      {modal?.type === "post" && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(null);
          }}
        >
          <section
            className="modal post-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="post-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow eyebrow--dark">
                  <span className="eyebrow-line" />{" "}
                  {cropInfo.name.toUpperCase()} SELLER
                </span>
                <h2>
                  Share your <em>{titleCrop}.</em>
                </h2>
                <p>
                  Your account number is shared when a buyer requests contact.
                </p>
              </div>
              <button
                className="close-button"
                onClick={() => setModal(null)}
                aria-label="Close"
              >
                <X />
              </button>
            </div>
            <form
              className="listing-form"
              onSubmit={submitListing}
              encType="multipart/form-data"
            >
              <label className="form-full">
                Listing title
                <input
                  name="title"
                  minLength="5"
                  maxLength="100"
                  placeholder={`e.g. ${cropInfo.standingLabel} near Mumias`}
                  required
                />
              </label>
              <div
                className="form-full listing-type-choice"
                role="radiogroup"
                aria-label="What are you listing?"
              >
                <span className="choice-label">What are you offering?</span>
                <div>
                  <label
                    className={
                      listingKind === cropInfo.standingLabel
                        ? "choice-active"
                        : ""
                    }
                  >
                    <input
                      type="radio"
                      name="listing-kind"
                      value={cropInfo.standingLabel}
                      checked={listingKind === cropInfo.standingLabel}
                      onChange={() => setListingKind(cropInfo.standingLabel)}
                    />
                    <Leaf size={16} />
                    <span>
                      {cropInfo.standingLabel}
                      <small>Crop already growing</small>
                    </span>
                  </label>
                  <label
                    className={
                      listingKind === "Land for lease" ? "choice-active" : ""
                    }
                  >
                    <input
                      type="radio"
                      name="listing-kind"
                      value="Land for lease"
                      checked={listingKind === "Land for lease"}
                      onChange={() => setListingKind("Land for lease")}
                    />
                    <MapPin size={16} />
                    <span>
                      Land for lease<small>Land ready to plant</small>
                    </span>
                  </label>
                </div>
              </div>
              <label>
                County
                <select name="county" required defaultValue="">
                  <option value="" disabled>
                    Choose county
                  </option>
                  {counties.map((county) => (
                    <option key={county}>{county}</option>
                  ))}
                </select>
              </label>
              <label>
                Town or area
                <input
                  name="locality"
                  placeholder="Mumias West"
                  minLength="2"
                  maxLength="80"
                  required
                />
              </label>
              <label>
                Available acres
                <input
                  name="acres"
                  type="number"
                  min="0.25"
                  step="0.25"
                  placeholder="4.5"
                  required
                />
              </label>
              <label>
                {listingKind === cropInfo.standingLabel
                  ? "Crop price per acre (KSh)"
                  : "Annual lease per acre (KSh)"}
                <input
                  name="priceKes"
                  type="number"
                  min="1"
                  step="100"
                  placeholder={
                    listingKind === cropInfo.standingLabel ? "185000" : "28000"
                  }
                  required
                />
              </label>
              <label>
                {cropInfo.fieldLabel}
                <input
                  name="cropVariety"
                  placeholder={cropInfo.name}
                  minLength="2"
                  maxLength="80"
                  required
                />
              </label>
              <label>
                {listingKind === cropInfo.standingLabel
                  ? "Expected harvest"
                  : "Lease period"}
                <input
                  name="expectedHarvest"
                  placeholder={
                    listingKind === cropInfo.standingLabel
                      ? "Ready in 3 months"
                      : "3 years"
                  }
                  maxLength="80"
                />
              </label>
              <label className="form-full">
                Describe the crop or land
                <textarea
                  name="description"
                  rows="3"
                  maxLength="1000"
                  placeholder="Water access, road access, crop condition, or other useful details"
                />
              </label>
              <label className="form-full photo-input-label">
                Your land or crop photo
                <input
                  name="image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  required
                />
                <small>JPG, PNG, or WebP · up to 6 MB</small>
              </label>
              <button
                className="button button--green form-submit"
                type="submit"
              >
                Publish listing <ArrowRight size={17} />
              </button>
            </form>
            <p className="form-footnote">
              <CircleHelp size={14} /> Use a photo you have the right to share.
              Your number stays private until a buyer requests it.
            </p>
          </section>
        </div>
      )}

      {modal?.type === "details" && selected && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(null);
          }}
        >
          <section
            className="modal details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="details-title"
          >
            <button
              className="close-button details-close"
              onClick={() => setModal(null)}
              aria-label="Close"
            >
              <X />
            </button>
            <img
              className="details-image"
              src={imageUrl(selected.image)}
              alt={`${selected.kind} in ${selected.locality}`}
            />
            <div className="details-content">
              <span
                className={`deal-tag details-deal ${selected.kind === cropInfo.standingLabel ? "deal-tag--harvest" : ""}`}
              >
                {selected.kind}
              </span>
              <h2 id="details-title">{selected.title}</h2>
              <p className="listing-location">
                <MapPin size={15} /> {selected.district}
              </p>
              <div className="details-price">
                {money(selected.rate)}{" "}
                <small>
                  {selected.kind === cropInfo.standingLabel
                    ? "/ acre · crop"
                    : "/ acre · year"}
                </small>
              </div>
              <div className="details-facts">
                <span>
                  <strong>{selected.acres}</strong> acres available
                </span>
                <span>{selected.crop}</span>
                <span>
                  {selected.description ||
                    "Contact the grower for more details."}
                </span>
              </div>
              <div className="contact-grower">
                <span className="seller-avatar">
                  <Leaf size={13} />
                </span>
                <span>
                  <strong>{selected.seller}</strong>
                  <small>
                    {selected.verified ? "Mavuno member" : "Example listing"}
                  </small>
                </span>
                {contactPhone ? (
                  <a
                    className="button button--green"
                    href={`tel:${contactPhone}`}
                  >
                    Call {contactPhone}
                  </a>
                ) : (
                  <button
                    className="button button--green"
                    onClick={contactGrower}
                  >
                    Contact seller <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {modal?.type === "filters" && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(null);
          }}
        >
          <section
            className="modal filter-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="filter-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow eyebrow--dark">
                  <span className="eyebrow-line" /> MAKE IT YOURS
                </span>
                <h2 id="filter-title">
                  More <em>filters.</em>
                </h2>
              </div>
              <button
                className="close-button"
                onClick={() => setModal(null)}
                aria-label="Close"
              >
                <X />
              </button>
            </div>
            <label className="filter-check">
              <input
                type="checkbox"
                checked={showSaved}
                onChange={(event) => setShowSaved(event.target.checked)}
              />{" "}
              Only show my saved listings <Heart size={16} />
            </label>
            <label className="filter-check">
              <span>Minimum acres</span>
              <input
                className="mini-number"
                type="number"
                min="0"
                step="1"
                placeholder="Any"
                value={minAcres || ""}
                onChange={(event) =>
                  setMinAcres(Number(event.target.value) || 0)
                }
              />
            </label>
            <p className="filter-hint">
              Choose a county and listing type from the marketplace controls to
              narrow the results.
            </p>
            <button
              className="button button--green form-submit"
              onClick={() => setModal(null)}
            >
              Show {filteredListings.length} listings <ArrowRight size={16} />
            </button>
          </section>
        </div>
      )}

      {modal?.type === "menu" && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(null);
          }}
        >
          <section className="modal mobile-nav-modal">
            <button
              className="close-button"
              onClick={() => setModal(null)}
              aria-label="Close"
            >
              <X />
            </button>
            <a href="#market" onClick={() => setModal(null)}>
              Marketplace <ChevronRight />
            </a>
            <a href="#how-it-works" onClick={() => setModal(null)}>
              How it works <ChevronRight />
            </a>
            <button
              className="mobile-context-action"
              onClick={() => openContextPicker()}
            >
              {cropInfo.name} · {activeRole} <ChevronDown size={15} />
            </button>
            {user ? (
              <button className="mobile-context-action" onClick={signOut}>
                Sign out <ChevronRight size={15} />
              </button>
            ) : (
              <button
                className="mobile-context-action"
                onClick={() => openAuth("login")}
              >
                Sign in <ChevronRight size={15} />
              </button>
            )}
            <button
              className="button button--green"
              onClick={() => {
                setModal(null);
                openPost();
              }}
            >
              <Plus size={16} /> Post a listing
            </button>
          </section>
        </div>
      )}

      {toast && (
        <div className="toast">
          <span>
            <Check size={15} />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
