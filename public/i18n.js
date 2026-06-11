(() => {
  const storageKey = "wc_language";
  const supported = new Set(["en", "el"]);
  const saved = localStorage.getItem(storageKey);
  const systemLanguage = String(navigator.language || "en").toLowerCase().startsWith("el") ? "el" : "en";
  let language = supported.has(saved) ? saved : systemLanguage;
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();

  const greek = {
    "World Cup Predictor": "Προβλέψεις Παγκοσμίου Κυπέλλου",
    "World Cup Bracket - World Cup Predictor": "Ταμπλό Παγκοσμίου Κυπέλλου - Προβλέψεις Παγκοσμίου Κυπέλλου",
    "Leaderboard - World Cup Predictor": "Κατάταξη - Προβλέψεις Παγκοσμίου Κυπέλλου",
    "My Teams - World Cup Predictor": "Οι ομάδες μου - Προβλέψεις Παγκοσμίου Κυπέλλου",
    "Profile - World Cup Predictor": "Προφίλ - Προβλέψεις Παγκοσμίου Κυπέλλου",
    "Admin - World Cup Predictor": "Διαχείριση - Προβλέψεις Παγκοσμίου Κυπέλλου",
    "Log In - World Cup Predictor": "Σύνδεση - Προβλέψεις Παγκοσμίου Κυπέλλου",
    "Register - World Cup Predictor": "Εγγραφή - Προβλέψεις Παγκοσμίου Κυπέλλου",
    "Forgot Password - World Cup Predictor": "Ξέχασα τον κωδικό - Προβλέψεις Παγκοσμίου Κυπέλλου",
    "Reset Password - World Cup Predictor": "Επαναφορά κωδικού - Προβλέψεις Παγκοσμίου Κυπέλλου",
    "World Cup 2026": "Παγκόσμιο Κύπελλο 2026",
    "Predictions": "Προβλέψεις",
    "Bracket": "Ταμπλό",
    "Leaderboard": "Κατάταξη",
    "My teams": "Οι ομάδες μου",
    "Admin": "Διαχείριση",
    "Profile": "Προφίλ",
    "Log in": "Σύνδεση",
    "Log out": "Αποσύνδεση",
    "Tournament bracket": "Ταμπλό διοργάνωσης",
    "Predict each group, choose the best third-place teams, and complete their knockout path.": "Πρόβλεψε κάθε όμιλο, επίλεξε τις καλύτερες τρίτες ομάδες και ολοκλήρωσε την πορεία τους στα νοκ άουτ.",
    "Group stage": "Φάση ομίλων",
    "Knockout bracket": "Ταμπλό νοκ άουτ",
    "Predicted standings": "Προβλεπόμενη κατάταξη",
    "Predicted champion": "Προβλεπόμενος πρωταθλητής",
    "Knockout stage": "Νοκ άουτ φάση",
    "Predicted path": "Προβλεπόμενη πορεία",
    "Save bracket": "Αποθήκευση ταμπλό",
    "Loading bracket...": "Φόρτωση ταμπλό...",
    "Not saved yet": "Δεν έχει αποθηκευτεί",
    "Match predictions": "Προβλέψεις αγώνων",
    "Browse fixtures, save scores, and track your predictions.": "Δες τους αγώνες, αποθήκευσε σκορ και παρακολούθησε τις προβλέψεις σου.",
    "Group by": "Ομαδοποίηση κατά",
    "Date": "Ημερομηνία",
    "Team": "Ομάδα",
    "Phase": "Φάση",
    "Find a match": "Αναζήτηση αγώνα",
    "Search team or venue": "Αναζήτηση ομάδας ή γηπέδου",
    "Stage": "Φάση",
    "All stages": "Όλες οι φάσεις",
    "All teams": "Όλες οι ομάδες",
    "Clear": "Καθαρισμός",
    "Save": "Αποθήκευση",
    "saved predictions": "αποθηκευμένες προβλέψεις",
    "active view": "ενεργή προβολή",
    "Standings": "Κατάταξη",
    "3 points for an exact score, 1 point for the correct result.": "3 βαθμοί για ακριβές σκορ, 1 βαθμός για σωστό αποτέλεσμα.",
    "players": "παίκτες",
    "graded predictions": "βαθμολογημένες προβλέψεις",
    "leading points": "βαθμοί πρώτου",
    "Rank": "Θέση",
    "Player": "Παίκτης",
    "Points": "Βαθμοί",
    "Exact scores": "Ακριβή σκορ",
    "Correct results": "Σωστά αποτελέσματα",
    "Graded": "Βαθμολογημένες",
    "Private standings": "Ιδιωτική κατάταξη",
    "Create a group or join one with an invite code.": "Δημιούργησε μια ομάδα ή μπες σε μία με κωδικό πρόσκλησης.",
    "Team name": "Όνομα ομάδας",
    "Create team": "Δημιουργία ομάδας",
    "Invite code": "Κωδικός πρόσκλησης",
    "Join team": "Συμμετοχή",
    "Your teams": "Οι ομάδες σου",
    "Team standings": "Κατάταξη ομάδας",
    "Player profile": "Προφίλ παίκτη",
    "points": "βαθμοί",
    "predictions": "προβλέψεις",
    "graded": "βαθμολογημένες",
    "exact scores": "ακριβή σκορ",
    "correct results": "σωστά αποτελέσματα",
    "History": "Ιστορικό",
    "My predictions": "Οι προβλέψεις μου",
    "Make predictions": "Κάνε προβλέψεις",
    "Loading profile...": "Φόρτωση προφίλ...",
    "Welcome back": "Καλώς ήρθες ξανά",
    "Continue with your saved predictions.": "Συνέχισε με τις αποθηκευμένες προβλέψεις σου.",
    "Email": "Email",
    "Password": "Κωδικός πρόσβασης",
    "Forgot password?": "Ξέχασες τον κωδικό;",
    "New here?": "Νέος χρήστης;",
    "Create an account": "Δημιουργία λογαριασμού",
    "Save predictions and track your results.": "Αποθήκευσε προβλέψεις και παρακολούθησε τα αποτελέσματά σου.",
    "Name": "Όνομα",
    "Public nickname": "Δημόσιο ψευδώνυμο",
    "Register": "Εγγραφή",
    "Already registered?": "Έχεις ήδη εγγραφεί;",
    "Reset your password": "Επαναφορά κωδικού πρόσβασης",
    "Enter your account email, then contact the administrator to receive your reset link.": "Πληκτρολόγησε το email του λογαριασμού σου και επικοινώνησε με τον διαχειριστή για τον σύνδεσμο επαναφοράς.",
    "Request reset": "Αίτημα επαναφοράς",
    "Back to login": "Επιστροφή στη σύνδεση",
    "Choose a new password": "Επίλεξε νέο κωδικό",
    "Reset links expire after 15 minutes and can be used once.": "Οι σύνδεσμοι επαναφοράς λήγουν μετά από 15 λεπτά και χρησιμοποιούνται μία φορά.",
    "New password": "Νέος κωδικός",
    "Confirm password": "Επιβεβαίωση κωδικού",
    "Update password": "Ενημέρωση κωδικού",
    "Access blocked": "Απαγορευμένη πρόσβαση",
    "That shot hit the crossbar.": "Αυτό το σουτ βρήκε στο δοκάρι.",
    "You need admin permission to open this page.": "Χρειάζεσαι δικαιώματα διαχειριστή για να ανοίξεις αυτή τη σελίδα.",
    "Back to home": "Επιστροφή στην αρχική",
    "404 - page not found": "404 - η σελίδα δεν βρέθηκε",
    "That shot went wide.": "Αυτό το σουτ πέρασε άουτ.",
    "The page you were looking for does not exist or may have moved.": "Η σελίδα που αναζητάς δεν υπάρχει ή μπορεί να έχει μετακινηθεί.",
    "Back to bracket": "Επιστροφή στο ταμπλό",
    "Admin Access Error": "Σφάλμα πρόσβασης διαχειριστή",
    "Page Not Found - World Cup Predictor": "Η σελίδα δεν βρέθηκε - Προβλέψεις Παγκοσμίου Κυπέλλου",
    "Prediction dashboard": "Πίνακας προβλέψεων",
    "Review users, votes, predictions, and results.": "Έλεγξε χρήστες, ψήφους, προβλέψεις και αποτελέσματα.",
    "registered users": "εγγεγραμμένοι χρήστες",
    "total predictions": "συνολικές προβλέψεις",
    "matches with votes": "αγώνες με ψήφους",
    "Users": "Χρήστες",
    "Teams": "Ομάδες",
    "Game stats": "Στατιστικά αγώνων",
    "Results": "Αποτελέσματα",
    "Password resets": "Επαναφορές κωδικού",
    "Metrics": "Μετρικές",
    "Search users or matches": "Αναζήτηση χρηστών ή αγώνων",
    "All phases": "Όλες οι φάσεις",
    "All Users": "Όλοι οι χρήστες",
    "User": "Χρήστης",
    "Exact score": "Ακριβές σκορ",
    "Result 1/x/2": "Αποτέλεσμα 1/Χ/2",
    "Open": "Άνοιγμα",
    "All Teams": "Όλες οι ομάδες",
    "User Predictions": "Προβλέψεις χρήστη",
    "Close": "Κλείσιμο",
    "Match": "Αγώνας",
    "Prediction": "Πρόβλεψη",
    "Result": "Αποτέλεσμα",
    "Exact": "Ακριβές",
    "All User Predictions": "Όλες οι προβλέψεις χρηστών",
    "Updated": "Ενημερώθηκε",
    "Edit": "Επεξεργασία",
    "Voting Stats By Game": "Στατιστικά ψήφων ανά αγώνα",
    "Votes": "Ψήφοι",
    "Outcomes": "Εκβάσεις",
    "Average Score": "Μέσο σκορ",
    "Actual Results": "Πραγματικά αποτελέσματα",
    "Update results": "Ενημέρωση αποτελεσμάτων",
    "Current result": "Τρέχον αποτέλεσμα",
    "Edit actual score": "Επεξεργασία πραγματικού σκορ",
    "Password Reset Requests": "Αιτήματα επαναφοράς κωδικού",
    "Application Metrics": "Μετρικές εφαρμογής",
    "Not loaded": "Δεν φορτώθηκε",
    "Refresh": "Ανανέωση",
    "Requests, last 15 minutes": "Αιτήματα, τελευταία 15 λεπτά",
    "Requests and application errors": "Αιτήματα και σφάλματα εφαρμογής",
    "Response status": "Κατάσταση απόκρισης",
    "Last 5 minutes": "Τελευταία 5 λεπτά",
    "Most requested routes": "Δημοφιλέστερες διαδρομές",
    "Loading standings...": "Φόρτωση κατάταξης...",
    "No players yet.": "Δεν υπάρχουν ακόμη παίκτες.",
    "Search players": "Αναζήτηση παικτών",
    "Search by nickname": "Αναζήτηση με ψευδώνυμο",
    "No players match your search.": "Δεν βρέθηκαν παίκτες για αυτή την αναζήτηση.",
    "Player Predictions - World Cup Predictor": "Προβλέψεις παίκτη - Προβλέψεις Παγκοσμίου Κυπέλλου",
    "Player predictions": "Προβλέψεις παίκτη",
    "Scores, group standings, and knockout picks.": "Σκορ, κατάταξη ομίλων και επιλογές νοκ άουτ.",
    "Match scores": "Σκορ αγώνων",
    "Loading predictions...": "Φόρτωση προβλέψεων...",
    "This player has not made any match predictions yet.": "Αυτός ο παίκτης δεν έχει κάνει ακόμη προβλέψεις αγώνων.",
    "This player has not saved group predictions yet.": "Αυτός ο παίκτης δεν έχει αποθηκεύσει ακόμη προβλέψεις ομίλων.",
    "This player has not saved a bracket yet.": "Αυτός ο παίκτης δεν έχει αποθηκεύσει ακόμη ταμπλό.",
    "Qualified": "Προκρίθηκε",
    "Awaiting final score": "Αναμονή τελικού σκορ",
    "Not completed": "Δεν ολοκληρώθηκε",
    "Player not found.": "Ο παίκτης δεν βρέθηκε.",
    "No matches found": "Δεν βρέθηκαν αγώνες",
    "Clear filters": "Καθαρισμός φίλτρων",
    "Fixtures will appear here when available.": "Οι αγώνες θα εμφανιστούν εδώ όταν γίνουν διαθέσιμοι.",
    "Log in to save predictions.": "Συνδέσου για να αποθηκεύσεις προβλέψεις.",
    "Prediction saved.": "Η πρόβλεψη αποθηκεύτηκε.",
    "Predictions are locked after kickoff.": "Οι προβλέψεις κλειδώνουν μετά την έναρξη.",
    "Please register or log in first.": "Κάνε πρώτα εγγραφή ή σύνδεση.",
    "Enter both scores.": "Συμπλήρωσε και τα δύο σκορ.",
    "Saving...": "Αποθήκευση...",
    "Please fix the highlighted fields.": "Διόρθωσε τα επισημασμένα πεδία.",
    "Bracket saved.": "Το ταμπλό αποθηκεύτηκε.",
    "Saving bracket...": "Αποθήκευση ταμπλό...",
    "Only eight third-place teams can qualify.": "Μόνο οκτώ τρίτες ομάδες μπορούν να προκριθούν.",
    "That combination cannot produce valid Round-of-32 crossings.": "Αυτός ο συνδυασμός δεν δημιουργεί έγκυρες διασταυρώσεις στη φάση των 32.",
    "Waiting for group prediction": "Αναμονή πρόβλεψης ομίλου",
    "Waiting for previous winner": "Αναμονή προηγούμενου νικητή",
    "Locked": "Κλειδωμένο",
    "Win": "Νίκη",
    "1st": "1η",
    "2nd": "2η",
    "3rd": "3η",
    "4th": "4η",
    "Round of 32": "Φάση των 32",
    "Round of 16": "Φάση των 16",
    "Quarter-finals": "Προημιτελικά",
    "Semi-finals": "Ημιτελικά",
    "Finals": "Τελικοί",
    "Final": "Τελικός",
    "Third place": "Μικρός τελικός",
    "Group stage": "Φάση ομίλων",
    "Switch to light mode": "Μετάβαση σε φωτεινό θέμα",
    "Switch to dark mode": "Μετάβαση σε σκοτεινό θέμα",
    "Light mode": "Φωτεινό θέμα",
    "Dark mode": "Σκοτεινό θέμα",
    "Light": "Φωτεινό",
    "Dark": "Σκοτεινό",
    "Prediction updated.": "Η πρόβλεψη ενημερώθηκε.",
    "Result updated. User percentages recalculated.": "Το αποτέλεσμα ενημερώθηκε και τα ποσοστά των χρηστών υπολογίστηκαν ξανά.",
    "Updating match results...": "Ενημέρωση αποτελεσμάτων...",
    "Password reset URL copied.": "Ο σύνδεσμος επαναφοράς αντιγράφηκε.",
    "Unable to copy automatically. Select and copy the URL from the field.": "Δεν ήταν δυνατή η αυτόματη αντιγραφή. Επίλεξε και αντέγραψε τον σύνδεσμο από το πεδίο.",
    "A new password reset URL was created and copied.": "Δημιουργήθηκε και αντιγράφηκε νέος σύνδεσμος επαναφοράς.",
    "Loading admin data...": "Φόρτωση δεδομένων διαχείρισης...",
    "Email is required.": "Το email είναι υποχρεωτικό.",
    "Submitting request...": "Υποβολή αιτήματος...",
    "Reset token is missing. Create a new reset link.": "Λείπει το διακριτικό επαναφοράς. Δημιούργησε νέο σύνδεσμο.",
    "Password must be at least 8 characters.": "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.",
    "Passwords do not match.": "Οι κωδικοί δεν ταιριάζουν.",
    "Updating password...": "Ενημέρωση κωδικού...",
    "Invite code copied.": "Ο κωδικός πρόσκλησης αντιγράφηκε.",
    "Enter a team name.": "Συμπλήρωσε όνομα ομάδας.",
    "Team created.": "Η ομάδα δημιουργήθηκε.",
    "Something went wrong. Please try again later.": "Κάτι πήγε στραβά. Δοκίμασε ξανά αργότερα.",
    "Fixtures are temporarily unavailable. Please try again later.": "Οι αγώνες δεν είναι προσωρινά διαθέσιμοι. Δοκίμασε ξανά αργότερα.",
    "Not signed in.": "Δεν έχεις συνδεθεί.",
    "Request failed.": "Το αίτημα απέτυχε."
  };

  const patterns = [
    [/^(\d+) matches$/, "$1 αγώνες"],
    [/^(\d+) users$/, "$1 χρήστες"],
    [/^(\d+) teams$/, "$1 ομάδες"],
    [/^(\d+) rows$/, "$1 γραμμές"],
    [/^(\d+) requests$/, "$1 αιτήματα"],
    [/^(\d+) players$/, "$1 παίκτες"],
    [/^(\d+) of 32 winners selected$/, "$1 από 32 νικητές επιλεγμένοι"],
    [/^(\d+) of 8 third-place qualifiers$/, "$1 από 8 τρίτες ομάδες"],
    [/^Group ([A-L])$/, "Όμιλος $1"],
    [/^Winner Group ([A-L])$/, "Νικητής ομίλου $1"],
    [/^Runner-up Group ([A-L])$/, "Δεύτερος ομίλου $1"],
    [/^Third place Group (.+)$/, "Τρίτη θέση ομίλου $1"],
    [/^Winner (M\d+)$/, "Νικητής $1"],
    [/^Loser (M\d+)$/, "Ηττημένος $1"],
    [/^Saved (.+)$/, "Αποθηκεύτηκε $1"],
    [/^Updated (.+)$/, "Ενημερώθηκε $1"],
    [/^Final score (.+)$/, "Τελικό σκορ $1"],
    [/^(\d+) points$/, "$1 βαθμοί"],
    [/^(\d+) point$/, "$1 βαθμός"],
    [/^(.+) advances as a best third-place team$/, "$1 προκρίνεται ως μία από τις καλύτερες τρίτες ομάδες"],
    [/^(.+) win: (\d+)$/, "Νίκη $1: $2"],
    [/^Draw: (\d+)$/, "Ισοπαλία: $1"],
    [/^(\d+) people voted$/, "$1 άτομα ψήφισαν"],
    [/^(\d+) saved picks$/, "$1 αποθηκευμένες επιλογές"],
    [/^(\d+) predictions$/, "$1 προβλέψεις"]
  ];

  function translateString(value) {
    if (language === "en") return value;
    const trimmed = String(value).trim();
    if (!trimmed) return value;
    if (greek[trimmed]) return greek[trimmed];
    for (const [pattern, replacement] of patterns) {
      if (pattern.test(trimmed)) return trimmed.replace(pattern, replacement);
    }
    return value;
  }

  function translateTextNode(node) {
    if (!originalText.has(node)) originalText.set(node, node.nodeValue);
    const source = originalText.get(node);
    const translated = translateString(source);
    if (node.nodeValue !== translated) node.nodeValue = translated;
  }

  function translateElement(element) {
    if (!(element instanceof Element) || element.closest("[data-no-i18n]")) return;
    const attributes = ["placeholder", "title", "aria-label"];
    if (!originalAttributes.has(element)) originalAttributes.set(element, {});
    const originals = originalAttributes.get(element);
    attributes.forEach((name) => {
      if (!element.hasAttribute(name)) return;
      if (!(name in originals)) originals[name] = element.getAttribute(name);
      element.setAttribute(name, translateString(originals[name]));
    });
    [...element.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) translateTextNode(child);
    });
    [...element.children].forEach(translateElement);
  }

  function applyLanguage() {
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
    document.title = translateString(originalDocumentTitle);
    if (document.body) translateElement(document.body);
    const selector = document.querySelector("#languageSelect");
    if (selector) selector.value = language;
    document.dispatchEvent(new CustomEvent("wc:languagechange", { detail: { language } }));
  }

  const originalDocumentTitle = document.title;
  const observer = new MutationObserver((mutations) => {
    observer.disconnect();
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
        if (node.nodeType === Node.ELEMENT_NODE) translateElement(node);
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });

  document.documentElement.lang = language;
  document.documentElement.dataset.language = language;

  document.addEventListener("DOMContentLoaded", () => {
    const wrapper = document.createElement("label");
    wrapper.className = "language-control";
    wrapper.setAttribute("aria-label", "Language");
    wrapper.innerHTML = `
      <span class="visually-hidden">Language</span>
      <select id="languageSelect" aria-label="Language">
        <option value="en">English</option>
        <option value="el">Ελληνικά</option>
      </select>
    `;
    document.body.append(wrapper);
    wrapper.querySelector("select").addEventListener("change", (event) => {
      language = event.target.value;
      localStorage.setItem(storageKey, language);
      window.location.reload();
    });
    applyLanguage();
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });

  window.wcI18n = {
    get language() {
      return language;
    },
    translate: translateString
  };
})();
