import { auth, db } from "./firebase-config.js";
import { initAdmin, chargerUtilisateurs, lireFilmsAjoutes } from "./admin.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// =====================================================
// 1. ELEMENTS HTML
// =====================================================

const accueil = document.getElementById("accueil");
const connexion = document.getElementById("connexion");
const inscription = document.getElementById("inscription");
const catalogue = document.getElementById("catalogue");
const pageFavoris = document.getElementById("page-favoris");
const pageProfil = document.getElementById("page-profil");
const pageAdmin = document.getElementById("page-admin");
const btnAdmin = document.getElementById("btn-admin");
const actionsUtilisateur =
  document.getElementById("actions-utilisateur");

const btnConnexion = document.getElementById("btn-connexion");
const btnInscription = document.getElementById("btn-inscription");
const btnFilms = document.getElementById("btn-films");
const btnCreerCompte = document.getElementById("btn-creer-compte");
const btnLogin = document.getElementById("btn-login");
const btnMesFavoris = document.getElementById("btn-mes-favoris");
const btnMonProfil = document.getElementById("btn-mon-profil");
const btnDeconnexion = document.getElementById("btn-deconnexion");

const listeFilms = document.getElementById("liste-films");
const rechercheFilm = document.getElementById("recherche-film");
const messageCatalogue = document.getElementById("message-catalogue");

const listeFavoris = document.getElementById("liste-favoris");
const messageFavoris = document.getElementById("message-favoris");

const photoInscription = document.getElementById("photo-inscription");
const apercuPhoto = document.getElementById("apercu-photo");

const btnPrendrePhoto = document.getElementById("btn-prendre-photo");
const zoneCamera = document.getElementById("zone-camera");
const cameraVideo = document.getElementById("camera-video");
const btnCapturerPhoto = document.getElementById("btn-capturer-photo");
const btnFermerCamera = document.getElementById("btn-fermer-camera");

let photoSelectionnee = "";
let fluxCamera = null;
let utilisateurConnecte = null;
let profilConnecte = null;

// =====================================================
// 2. NOTIFICATIONS IONIC
// =====================================================

async function afficherNotification(message, couleur = "success") {
  const toast = document.createElement("ion-toast");

  toast.message = message;
  toast.duration = 2800;
  toast.position = "top";
  toast.color = couleur;

  document.body.appendChild(toast);

  try {
    await toast.present();
  } catch (erreur) {
    console.error("Erreur notification :", erreur);
    toast.remove();
    return;
  }

  toast.addEventListener(
    "ionToastDidDismiss",
    () => toast.remove(),
    { once: true }
  );
}

// =====================================================
// 3. PROFIL FIRESTORE ET SESSION FIREBASE
// =====================================================

async function chargerProfilFirebase(user) {
  const reference = doc(db, "users", user.uid);
  const resultat = await getDoc(reference);

  if (!resultat.exists()) {
    return null;
  }

  return {
    uid: user.uid,
    ...resultat.data()
  };
}

function obtenirUtilisateurConnecte() {
  return profilConnecte;
}

function estAdmin() {
  return profilConnecte?.role === "admin" && profilConnecte?.actif === true;
}

function verifierConnexion() {
  if (!utilisateurConnecte || !profilConnecte) {
    afficherNotification(
      "Connecte-toi pour accéder à cette page.",
      "warning"
    );

    afficherPage(connexion);
    return false;
  }

  if (profilConnecte.actif !== true) {
    afficherNotification(
      "Ce compte est désactivé.",
      "danger"
    );

    return false;
  }

  return true;
}

function mettreAJourActionsUtilisateur() {
  if (actionsUtilisateur) {
    actionsUtilisateur.hidden = !(
      utilisateurConnecte &&
      profilConnecte &&
      catalogue &&
      !catalogue.hidden
    );
  }

  // Le bouton admin n'apparaît que pour un administrateur
  if (btnAdmin) {
    btnAdmin.hidden = !estAdmin();
  }
}

// Firebase restaure automatiquement la session.
onAuthStateChanged(auth, async (user) => {
  utilisateurConnecte = user;
  profilConnecte = null;

  try {
    if (user) {
      profilConnecte = await chargerProfilFirebase(user);

      if (!profilConnecte) {
        console.warn("Profil Firestore introuvable.");
      } else if (profilConnecte.actif !== true) {
        await signOut(auth);

        utilisateurConnecte = null;
        profilConnecte = null;

        afficherNotification(
          "Ce compte est désactivé. Contacte l'administrateur.",
          "danger"
        );
      }
    }
  } catch (erreur) {
    console.error("Erreur de récupération du profil :", erreur);
    profilConnecte = null;
  }

  mettreAJourActionsUtilisateur();
});

// =====================================================
// 4. NAVIGATION
// =====================================================

function afficherPage(page) {
  if (page === pageFavoris || page === pageProfil) {
    if (!verifierConnexion()) {
      return;
    }
  }

  // Page admin : connecté ET administrateur
  if (page === pageAdmin) {
    if (!verifierConnexion()) {
      return;
    }

    if (!estAdmin()) {
      afficherNotification("Accès réservé aux administrateurs.", "danger");
      return;
    }
  }

  [
    accueil,
    connexion,
    inscription,
    catalogue,
    pageFavoris,
    pageProfil,
    pageAdmin
  ].forEach((element) => {
    if (element) {
      element.hidden = true;
    }
  });

  if (page) {
    page.hidden = false;
  }

  mettreAJourActionsUtilisateur();

  const contenu = document.querySelector("ion-content");

  if (contenu && typeof contenu.scrollToTop === "function") {
    contenu.scrollToTop(300);
  }
}

function retournerAccueil() {
  if (utilisateurConnecte && profilConnecte) {
    afficherPage(catalogue);
    chargerFilms();
  } else {
    afficherPage(accueil);
  }
}

btnConnexion?.addEventListener("click", () => {
  afficherPage(connexion);
});

btnInscription?.addEventListener("click", () => {
  afficherPage(inscription);
});

btnFilms?.addEventListener("click", () => {
  afficherPage(catalogue);
  chargerFilms();
});

document
  .getElementById("btn-retour-connexion")
  ?.addEventListener("click", () => afficherPage(accueil));

document
  .getElementById("btn-retour-inscription")
  ?.addEventListener("click", () => afficherPage(accueil));

document
  .getElementById("btn-retour-catalogue")
  ?.addEventListener("click", retournerAccueil);

document
  .getElementById("btn-retour-favoris")
  ?.addEventListener("click", () => {
    if (verifierConnexion()) {
      afficherPage(catalogue);
    }
  });

document
  .getElementById("btn-retour-profil")
  ?.addEventListener("click", () => {
    if (verifierConnexion()) {
      afficherPage(catalogue);
    }
  });

btnAdmin?.addEventListener("click", async () => {
  afficherPage(pageAdmin);

  if (estAdmin()) {
    await chargerUtilisateurs();
  }
});

document
  .getElementById("btn-retour-admin")
  ?.addEventListener("click", () => {
    afficherPage(catalogue);
    chargerFilms(); // pour voir les films qu'on vient d'ajouter
  });
  

// =====================================================
// 5. PHOTO DE PROFIL ET CAMERA
// =====================================================

function afficherApercuPhoto(source) {
  if (!apercuPhoto) return;

  if (!source) {
    apercuPhoto.hidden = true;
    apercuPhoto.removeAttribute("src");
    return;
  }

  apercuPhoto.src = source;
  apercuPhoto.hidden = false;
}

function fermerCamera() {
  if (fluxCamera) {
    fluxCamera.getTracks().forEach((piste) => {
      piste.stop();
    });

    fluxCamera = null;
  }

  if (cameraVideo) {
    cameraVideo.srcObject = null;
  }

  if (zoneCamera) {
    zoneCamera.hidden = true;
  }
}

btnPrendrePhoto?.addEventListener("click", async () => {
  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    afficherNotification(
      "La caméra nécessite localhost ou une connexion HTTPS.",
      "warning"
    );
    return;
  }

  try {
    fermerCamera();

    fluxCamera = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });

    cameraVideo.srcObject = fluxCamera;
    zoneCamera.hidden = false;

    await cameraVideo.play();
  } catch (erreur) {
    console.error("Erreur caméra :", erreur);
    fermerCamera();

    if (erreur.name === "NotAllowedError") {
      afficherNotification(
        "Autorise l'accès à la caméra dans les paramètres du navigateur.",
        "danger"
      );
    } else if (erreur.name === "NotFoundError") {
      afficherNotification(
        "Aucune caméra n'a été détectée.",
        "danger"
      );
    } else {
      afficherNotification(
        "Impossible d'ouvrir la caméra.",
        "danger"
      );
    }
  }
});

btnCapturerPhoto?.addEventListener("click", () => {
  if (!cameraVideo?.videoWidth || !cameraVideo?.videoHeight) {
    afficherNotification(
      "Attends que la caméra soit prête.",
      "warning"
    );
    return;
  }

  const canvas = document.createElement("canvas");
  const tailleMax = 500;

  const facteur = Math.min(
    1,
    tailleMax / Math.max(
      cameraVideo.videoWidth,
      cameraVideo.videoHeight
    )
  );

  canvas.width = Math.round(cameraVideo.videoWidth * facteur);
  canvas.height = Math.round(cameraVideo.videoHeight * facteur);

  const contexte = canvas.getContext("2d");

  contexte.drawImage(
    cameraVideo,
    0,
    0,
    canvas.width,
    canvas.height
  );

  photoSelectionnee = canvas.toDataURL("image/jpeg", 0.72);

  afficherApercuPhoto(photoSelectionnee);
  fermerCamera();

  afficherNotification(
    "Photo capturée avec succès !",
    "success"
  );
});

btnFermerCamera?.addEventListener("click", fermerCamera);

photoInscription?.addEventListener("change", () => {
  const fichier = photoInscription.files?.[0];

  if (!fichier) return;

  if (!fichier.type.startsWith("image/")) {
    afficherNotification(
      "Veuillez sélectionner une image valide.",
      "warning"
    );

    photoInscription.value = "";
    return;
  }

  if (fichier.size > 2 * 1024 * 1024) {
    afficherNotification(
      "La photo ne doit pas dépasser 2 Mo.",
      "warning"
    );

    photoInscription.value = "";
    return;
  }

  const lecteur = new FileReader();

  lecteur.onload = (event) => {
    photoSelectionnee = event.target.result;
    afficherApercuPhoto(photoSelectionnee);

    afficherNotification(
      "Photo sélectionnée avec succès !",
      "success"
    );
  };

  lecteur.onerror = () => {
    afficherNotification(
      "Impossible de lire cette image.",
      "danger"
    );
  };

  lecteur.readAsDataURL(fichier);
});

// =====================================================
// 6. INSCRIPTION FIREBASE
// =====================================================

btnCreerCompte?.addEventListener("click", async () => {
  const nom =
    document.getElementById("nom")?.value.trim() || "";

  const prenom =
    document.getElementById("prenom")?.value.trim() || "";

  const age = Number(
    document.getElementById("age")?.value
  );

  const email =
    document.getElementById("email-inscription")?.value.trim() || "";

  const motDePasse =
    document.getElementById("mdp-inscription")?.value || "";

  if (!nom || !prenom || !age || !email || !motDePasse) {
    afficherNotification(
      "Veuillez remplir tous les champs.",
      "warning"
    );
    return;
  }

  if (!Number.isInteger(age) || age < 1 || age > 120) {
    afficherNotification(
      "Veuillez saisir un âge valide.",
      "warning"
    );
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    afficherNotification(
      "Veuillez saisir une adresse e-mail valide.",
      "warning"
    );
    return;
  }

  if (motDePasse.length < 6) {
    afficherNotification(
      "Le mot de passe doit contenir au moins 6 caractères.",
      "warning"
    );
    return;
  }

  if (photoSelectionnee.length > 700000) {
    afficherNotification(
      "La photo est trop volumineuse. Utilise une image plus petite.",
      "warning"
    );
    return;
  }

  let nouvelUtilisateur = null;

  try {
    // 1. Création du compte dans Firebase Authentication.
    const resultat = await createUserWithEmailAndPassword(
      auth,
      email,
      motDePasse
    );

    nouvelUtilisateur = resultat.user;

    // 2. Création du profil dans Firestore.
    await setDoc(
      doc(db, "users", nouvelUtilisateur.uid),
      {
        nom,
        prenom,
        age,
        email: nouvelUtilisateur.email,
        photo: photoSelectionnee || "",
        role: "user",
        actif: true,
        createdAt: serverTimestamp()
      }
    );

    // 3. Nettoyage des champs.
    fermerCamera();
    photoSelectionnee = "";

    if (photoInscription) {
      photoInscription.value = "";
    }

    afficherApercuPhoto("");

    const champMdpInscription =
      document.getElementById("mdp-inscription");

    if (champMdpInscription) {
      champMdpInscription.value = "";
    }

    // 4. Déconnexion pour revenir au formulaire de connexion.
    await signOut(auth);

    const champEmail = document.getElementById("email");
    const champMdp = document.getElementById("mot-de-passe");

    if (champEmail) champEmail.value = email;
    if (champMdp) champMdp.value = "";

    afficherPage(connexion);

    afficherNotification(
      `Inscription réussie ! Bienvenue ${prenom} !`,
      "success"
    );
  } catch (erreur) {
    console.error("Erreur lors de l'inscription :", erreur);

    // Nettoyer le compte si sa création a réussi,
    // mais que l'enregistrement du profil a échoué.
    if (
      nouvelUtilisateur &&
      auth.currentUser?.uid === nouvelUtilisateur.uid
    ) {
      try {
        await deleteUser(nouvelUtilisateur);
      } catch (erreurSuppression) {
        console.error(
          "Impossible de supprimer le compte incomplet :",
          erreurSuppression
        );
      }
    }

    let message = "Une erreur est survenue lors de l'inscription.";

    if (erreur.code === "auth/email-already-in-use") {
      message = "Cette adresse e-mail est déjà utilisée.";
    } else if (erreur.code === "auth/invalid-email") {
      message = "L'adresse e-mail est invalide.";
    } else if (erreur.code === "auth/weak-password") {
      message = "Le mot de passe doit contenir au moins 6 caractères.";
    } else if (
      erreur.code === "permission-denied" ||
      erreur.code === "firestore/permission-denied"
    ) {
      message = "Accès Firestore refusé. Vérifie les règles de sécurité.";
    } else if (erreur.code === "auth/network-request-failed") {
      message = "Erreur réseau. Vérifie ta connexion Internet.";
    }

    afficherNotification(message, "danger");
  }
});

// =====================================================
// 7. CONNEXION FIREBASE — CORRECTION PRINCIPALE
// =====================================================

btnLogin?.addEventListener("click", async () => {
  const email =
    document.getElementById("email")?.value.trim() || "";

  const motDePasse =
    document.getElementById("mot-de-passe")?.value || "";

  if (!email || !motDePasse) {
    afficherNotification(
      "Veuillez saisir votre e-mail et votre mot de passe.",
      "warning"
    );
    return;
  }

  try {
    // Vérification des identifiants par Firebase Authentication.
    const resultat = await signInWithEmailAndPassword(
      auth,
      email,
      motDePasse
    );

    const user = resultat.user;

    // Récupération du profil Firestore.
    const profil = await chargerProfilFirebase(user);

    if (!profil) {
      await signOut(auth);

      afficherNotification(
        "Le compte existe, mais son profil MovieMatch est introuvable.",
        "danger"
      );
      return;
    }

    if (profil.actif !== true) {
      await signOut(auth);

      afficherNotification(
        "Ce compte est désactivé. Contacte l'administrateur.",
        "danger"
      );
      return;
    }

    utilisateurConnecte = user;
    profilConnecte = profil;

    const champMdp = document.getElementById("mot-de-passe");

    if (champMdp) {
      champMdp.value = "";
    }

    afficherPage(catalogue);
    mettreAJourActionsUtilisateur();

    await chargerFilms();

    afficherNotification(
      `Connexion réussie ! Bienvenue ${profil.prenom || ""} !`,
      "success"
    );
  } catch (erreur) {
    console.error("Erreur de connexion Firebase :", erreur);

    let message = "Impossible de se connecter. Réessaie.";

    if (
      erreur.code === "auth/invalid-credential" ||
      erreur.code === "auth/wrong-password" ||
      erreur.code === "auth/user-not-found"
    ) {
      message = "E-mail ou mot de passe incorrect.";
    } else if (erreur.code === "auth/invalid-email") {
      message = "L'adresse e-mail est invalide.";
    } else if (erreur.code === "auth/too-many-requests") {
      message = "Trop de tentatives. Réessaie plus tard.";
    } else if (erreur.code === "auth/network-request-failed") {
      message = "Erreur réseau. Vérifie ta connexion Internet.";
    } else if (
      erreur.code === "permission-denied" ||
      erreur.code === "firestore/permission-denied"
    ) {
      message =
        "Connexion effectuée, mais accès au profil Firestore refusé.";
    }

    afficherNotification(message, "danger");
  }
});

// =====================================================
// 8. CATALOGUE TMDB
// =====================================================

// Conserve ici ta clé TMDB actuelle.
const cleAPI = "8f3b7f30960bb2d7c063a5173362278c";

// Les films TMDB ont un chemin ("/abc.jpg"), ceux de l'admin une URL complète
function urlAffiche(chemin) {
  if (!chemin) return "";
  return chemin.startsWith("http")
    ? chemin
    : "https://image.tmdb.org/t/p/w500" + chemin;
}

async function chargerFilms(titre = "") {
  if (!listeFilms || !messageCatalogue) return;

  listeFilms.innerHTML = "";
  messageCatalogue.textContent = "Chargement des films...";

  let url;

  if (titre.trim() === "") {
    url =
      "https://api.themoviedb.org/3/movie/popular" +
      "?api_key=" + encodeURIComponent(cleAPI) +
      "&language=fr-FR&page=1";
  } else {
    url =
      "https://api.themoviedb.org/3/search/movie" +
      "?api_key=" + encodeURIComponent(cleAPI) +
      "&language=fr-FR&query=" +
      encodeURIComponent(titre.trim());
  }

  try {
    const reponse = await fetch(url);

    if (!reponse.ok) {
      throw new Error("Erreur API : " + reponse.status);
    }

    const donnees = await reponse.json();
    const filmsAdmin = await lireFilmsAjoutes(titre);
    const films = [...filmsAdmin, ...(donnees.results || [])];

    listeFilms.innerHTML = "";

    if (films.length === 0) {
      messageCatalogue.textContent = "Aucun film trouvé.";
      return;
    }

    messageCatalogue.textContent =
      `${films.length} film(s) affiché(s)`;

    films.forEach((film) => {
      const carte = document.createElement("div");
      carte.className = "film-card";

      if (film.poster_path) {
        const image = document.createElement("img");

        image.src = urlAffiche(film.poster_path);

        image.alt = "Affiche de " + film.title;
        image.loading = "lazy";

        carte.appendChild(image);
      }

      const informations = document.createElement("div");
      informations.className = "film-info";

      const titreFilm = document.createElement("h3");
      titreFilm.textContent = film.title;

      const note = document.createElement("p");
      note.textContent =
        "⭐ " + Number(film.vote_average || 0).toFixed(1) + "/10";

      const btnFavori = document.createElement("ion-button");

      btnFavori.setAttribute("expand", "block");
      btnFavori.setAttribute("fill", "outline");
      btnFavori.textContent = "❤️ Ajouter aux favoris";

      btnFavori.addEventListener("click", () => {
        ajouterFavori(film);
      });

      informations.append(titreFilm, note, btnFavori);
      carte.appendChild(informations);
      listeFilms.appendChild(carte);
    });
  } catch (erreur) {
    console.error("Erreur TMDB :", erreur);

    messageCatalogue.textContent =
      "Impossible de charger les films. Vérifie ta clé API et ta connexion Internet.";

    afficherNotification(
      "Impossible de charger les films.",
      "danger"
    );
  }
}

rechercheFilm?.addEventListener("ionInput", (event) => {
  chargerFilms(event.detail.value || "");
});

// =====================================================
// 9. FAVORIS DANS FIRESTORE
// =====================================================

function convertirFilm(film) {
  return {
    id: Number(film.id),
    titre: film.title || film.titre || "",
    affiche: film.poster_path || film.affiche || "",
    note: Number(film.vote_average ?? film.note ?? 0)
  };
}

async function ajouterFavori(filmTMDB) {
  if (!verifierConnexion()) return;

  const film = convertirFilm(filmTMDB);

  const referenceFavori = doc(
    db,
    "users",
    utilisateurConnecte.uid,
    "favorites",
    String(film.id)
  );

  try {
    const existant = await getDoc(referenceFavori);

    if (existant.exists()) {
      afficherNotification(
        "Ce film est déjà dans vos favoris.",
        "warning"
      );
      return;
    }

    await setDoc(referenceFavori, {
      id: film.id,
      titre: film.titre,
      affiche: film.affiche,
      note: film.note,
      createdAt: serverTimestamp()
    });

    afficherNotification(
      `${film.titre} ajouté aux favoris !`,
      "success"
    );
  } catch (erreur) {
    console.error("Erreur d'ajout aux favoris :", erreur);

    afficherNotification(
      "Impossible d'enregistrer ce favori dans Firestore.",
      "danger"
    );
  }
}

async function lireFavorisFirebase() {
  const resultat = await getDocs(
    collection(
      db,
      "users",
      utilisateurConnecte.uid,
      "favorites"
    )
  );

  return resultat.docs.map((document) => ({
    ...document.data(),
    documentId: document.id
  }));
}

async function afficherMesFavoris() {
  if (!verifierConnexion()) return;

  listeFavoris.innerHTML = "";
  messageFavoris.textContent = "Chargement des favoris...";

  afficherPage(pageFavoris);

  try {
    const favoris = await lireFavorisFirebase();

    listeFavoris.innerHTML = "";

    if (favoris.length === 0) {
      messageFavoris.textContent =
        "Vous n'avez pas encore de favoris.";
      return;
    }

    messageFavoris.textContent =
      `${favoris.length} film(s) favori(s)`;

    favoris.forEach((film) => {
      const carte = document.createElement("div");
      carte.className = "film-card";

      if (film.affiche) {
        const image = document.createElement("img");

        image.src = urlAffiche(film.affiche);

        image.alt = "Affiche de " + film.titre;
        image.loading = "lazy";

        carte.appendChild(image);
      }

      const informations = document.createElement("div");
      informations.className = "film-info";

      const titre = document.createElement("h3");
      titre.textContent = film.titre || "Film sans titre";

      const note = document.createElement("p");
      note.textContent =
        "⭐ " + Number(film.note || 0).toFixed(1) + "/10";

      const boutonSupprimer =
        document.createElement("ion-button");

      boutonSupprimer.setAttribute("expand", "block");
      boutonSupprimer.setAttribute("color", "danger");
      boutonSupprimer.textContent = "Supprimer";

      boutonSupprimer.addEventListener("click", () => {
        supprimerFavori(film.documentId);
      });

      informations.append(titre, note, boutonSupprimer);
      carte.appendChild(informations);
      listeFavoris.appendChild(carte);
    });
  } catch (erreur) {
    console.error("Erreur de lecture des favoris :", erreur);

    messageFavoris.textContent =
      "Impossible de charger les favoris.";

    afficherNotification(
      "Accès aux favoris refusé. Vérifie les règles Firestore.",
      "danger"
    );
  }
}

btnMesFavoris?.addEventListener("click", afficherMesFavoris);

async function supprimerFavori(idFilm) {
  if (!verifierConnexion()) return;

  try {
    await deleteDoc(
      doc(
        db,
        "users",
        utilisateurConnecte.uid,
        "favorites",
        String(idFilm)
      )
    );

    await afficherMesFavoris();

    afficherNotification(
      "Film supprimé des favoris !",
      "success"
    );
  } catch (erreur) {
    console.error("Erreur de suppression :", erreur);

    afficherNotification(
      "Impossible de supprimer ce favori.",
      "danger"
    );
  }
}

// =====================================================
// 10. MON PROFIL
// =====================================================

async function afficherProfil() {
  if (!verifierConnexion()) return;

  try {
    const profil = await chargerProfilFirebase(
      utilisateurConnecte
    );

    if (!profil) {
      afficherNotification("Profil introuvable.", "danger");
      return;
    }

    profilConnecte = profil;

    document.getElementById("profil-nom").textContent =
      profil.nom || "";

    document.getElementById("profil-prenom").textContent =
      profil.prenom || "";

    document.getElementById("profil-age").textContent =
      profil.age ?? "";

    document.getElementById("profil-email").textContent =
      profil.email || utilisateurConnecte.email || "";

    const photoProfil =
      document.getElementById("photo-profil");

    photoProfil.src =
      profil.photo ||
      "https://ionicframework.com/docs/img/demos/avatar.svg";

    afficherPage(pageProfil);
  } catch (erreur) {
    console.error("Erreur de lecture du profil :", erreur);

    afficherNotification(
      "Impossible de charger le profil.",
      "danger"
    );
  }
}

btnMonProfil?.addEventListener("click", afficherProfil);

// =====================================================
// 11. DECONNEXION FIREBASE
// =====================================================

btnDeconnexion?.addEventListener("click", async () => {
  if (!utilisateurConnecte) {
    afficherPage(accueil);
    return;
  }

  const alerte = document.createElement("ion-alert");

  alerte.header = "Déconnexion";
  alerte.message = "Voulez-vous vraiment vous déconnecter ?";

  alerte.buttons = [
    {
      text: "Annuler",
      role: "cancel"
    },
    {
      text: "Se déconnecter",
      role: "confirm"
    }
  ];

  document.body.appendChild(alerte);

  await alerte.present();

  const resultat = await alerte.onDidDismiss();
  alerte.remove();

  if (resultat.role !== "confirm") {
    return;
  }

  try {
    fermerCamera();

    await signOut(auth);

    utilisateurConnecte = null;
    profilConnecte = null;

    afficherPage(accueil);

    afficherNotification(
      "Vous êtes déconnectée.",
      "success"
    );
  } catch (erreur) {
    console.error("Erreur de déconnexion :", erreur);

    afficherNotification(
      "Impossible de se déconnecter. Réessaie.",
      "danger"
    );
  }
});

// =====================================================
// 12. INITIALISATION
// =====================================================

if (actionsUtilisateur) {
  actionsUtilisateur.hidden = true;
}
initAdmin({
  notifier: afficherNotification,
  obtenirProfil: obtenirUtilisateurConnecte,
  obtenirUid: () => utilisateurConnecte?.uid
});

afficherPage(accueil);