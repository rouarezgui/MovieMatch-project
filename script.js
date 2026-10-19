
import { auth, db, storage } from "./firebase-config.js";

import {
  Camera,
  CameraResultType,
  CameraSource
} from "@capacitor/camera";


import { Capacitor } from "@capacitor/core";

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
  serverTimestamp,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";

// =====================================================
// 1. ÉLÉMENTS HTML
// =====================================================

const pageMatching = document.getElementById("page-matching");
const btnMatching = document.getElementById("btn-matching");
const btnRetourMatching = document.getElementById("btn-retour-matching");
const listeMatching = document.getElementById("liste-matching");
const messageMatching = document.getElementById("message-matching");

const accueil = document.getElementById("accueil");
const connexion = document.getElementById("connexion");
const inscription = document.getElementById("inscription");
const catalogue = document.getElementById("catalogue");
const pageFavoris = document.getElementById("page-favoris");
const pageProfil = document.getElementById("page-profil");

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
}

// Restaurer automatiquement la session Firebase.
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
  if (
    page === pageFavoris ||
    page === pageProfil ||
    page === pageMatching
  ) {
    if (!verifierConnexion()) return;
  }

  [
    accueil,
    connexion,
    inscription,
    catalogue,
    pageFavoris,
    pageProfil,
    pageMatching
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

// =====================================================
// 5. PHOTO DE PROFIL ET CAMÉRA
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

// Prendre une photo lors de l'inscription.
btnPrendrePhoto?.addEventListener("click", async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const photo = await Camera.getPhoto({
        quality: 72,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      if (!photo.dataUrl) {
        afficherNotification(
          "La caméra n'a pas renvoyé de photo.",
          "warning"
        );
        return;
      }

      photoSelectionnee = photo.dataUrl;
      afficherApercuPhoto(photoSelectionnee);

      afficherNotification(
        "Photo capturée avec succès !",
        "success"
      );
    } catch (erreur) {
      if (
        erreur instanceof Error &&
        erreur.message === "User cancelled photos app"
      ) {
        return;
      }

      console.error("Erreur caméra native :", erreur);

      afficherNotification(
        "Impossible d'ouvrir la caméra. Vérifie les autorisations de l'application.",
        "danger"
      );
    }

    return;
  }

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
      "La caméra n'est pas prête.",
      "warning"
    );
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = cameraVideo.videoWidth;
  canvas.height = cameraVideo.videoHeight;

  const contexte = canvas.getContext("2d");

  if (!contexte) return;

  contexte.drawImage(
    cameraVideo,
    0,
    0,
    canvas.width,
    canvas.height
  );

  photoSelectionnee = canvas.toDataURL("image/jpeg", 0.85);
  afficherApercuPhoto(photoSelectionnee);
  fermerCamera();

  afficherNotification(
    "Photo capturée avec succès !",
    "success"
  );
});

btnFermerCamera?.addEventListener("click", fermerCamera);


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
    const resultat = await createUserWithEmailAndPassword(
      auth,
      email,
      motDePasse
    );

    nouvelUtilisateur = resultat.user;

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
    } else if (erreur.code === "permission-denied") {
      message = "Accès Firestore refusé. Vérifie les règles de sécurité.";
    } else if (erreur.code === "auth/network-request-failed") {
      message = "Erreur réseau. Vérifie ta connexion Internet.";
    }

    afficherNotification(message, "danger");
  }
});


 // =====================================================
 // 7. CONNEXION FIREBASE
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
    const resultat = await signInWithEmailAndPassword(
      auth,
      email,
      motDePasse
    );

    const user = resultat.user;
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
    } else if (erreur.code === "permission-denied") {
      message =
        "Connexion effectuée, mais accès au profil Firestore refusé.";
    }

    afficherNotification(message, "danger");
  }
});



 // =====================================================
 // 8. CATALOGUE TMDB
 // =====================================================

// Conserve ta clé API TMDB actuelle.
const cleAPI = "8f3b7f30960bb2d7c063a5173362278c";

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
    const films = donnees.results || [];

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
        image.src =
          "https://image.tmdb.org/t/p/w500" +
          film.poster_path;
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
        image.src =
          "https://image.tmdb.org/t/p/w500" + film.affiche;
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
 // 10. MATCHING ENTRE UTILISATEURS
 // Comparaison par titres des films favoris
 // =====================================================

function normaliserTitreFilm(titre) {
  return String(titre || "")
    .trim()
    .toLocaleLowerCase("fr")
    .replace(/\s+/g, " ");
}

async function obtenirFavorisUtilisateur(uid) {
  const resultat = await getDocs(
    collection(db, "users", uid, "favorites")
  );

  return new Set(
    resultat.docs
      .map((document) => {
        const film = document.data();

        return normaliserTitreFilm(
          film.titre || film.title || ""
        );
      })
      .filter(Boolean)
  );
}

function calculerTauxMatching(favorisA, favorisB) {
  const communs = [...favorisA].filter((titre) =>
    favorisB.has(titre)
  );

  const union = new Set([...favorisA, ...favorisB]);

  return {
    taux: union.size === 0
      ? 0
      : (communs.length / union.size) * 100,
    communs
  };
}

async function synchroniserProfilMatching(shareMatching) {
  const uid = utilisateurConnecte.uid;
  const titresFavoris = await obtenirFavorisUtilisateur(uid);

  await setDoc(
    doc(db, "matchingProfiles", uid),
    {
      prenom: profilConnecte.prenom || "Utilisateur",
      nom: profilConnecte.nom || "",
      favoriteTitles: [...titresFavoris],
      shareMatching
    }
  );

  return titresFavoris;
}

async function afficherMatching() {
  if (!verifierConnexion()) return;

  afficherPage(pageMatching);

  listeMatching.innerHTML = "";
  messageMatching.textContent = "Recherche des Matchs...";

  try {
    const uidConnecte = utilisateurConnecte.uid;

    const referenceProfil = doc(
      db,
      "matchingProfiles",
      uidConnecte
    );

    const profilExistant = await getDoc(referenceProfil);

    let participer;

    if (
      profilExistant.exists() &&
      profilExistant.data().shareMatching === true
    ) {
      participer = true;
    } else {
      participer = window.confirm(
        "Souhaites-tu participer au Matching ? " +
        "Ton prénom, ton nom et les titres de tes films favoris " +
        "seront partagés avec les autres participants."
      );
    }

    const mesFavoris =
      await synchroniserProfilMatching(participer);

    if (!participer) {
      listeMatching.innerHTML = "";
      messageMatching.textContent =
        "Tu ne participes pas au Matching.";
      return;
    }

    if (mesFavoris.size === 0) {
      messageMatching.textContent =
        "Ajoute des films à tes favoris pour trouver des Matchs.";
      return;
    }

    const requete = query(
      collection(db, "matchingProfiles"),
      where("shareMatching", "==", true)
    );

    const resultatProfils = await getDocs(requete);
    const compatibles = [];

    for (const documentProfil of resultatProfils.docs) {
      if (documentProfil.id === uidConnecte) continue;

      const profil = documentProfil.data();

      const favorisAutre = new Set(
        (profil.favoriteTitles || [])
          .map(normaliserTitreFilm)
          .filter(Boolean)
      );

      if (favorisAutre.size === 0) continue;

      const resultat = calculerTauxMatching(
        mesFavoris,
        favorisAutre
      );

      if (resultat.communs.length > 0) {
        compatibles.push({
          prenom: profil.prenom || "Utilisateur",
          nom: profil.nom || "",
          taux: resultat.taux,
          filmsCommuns: resultat.communs
        });
      }
    }

    compatibles.sort((a, b) => b.taux - a.taux);
    listeMatching.innerHTML = "";

    if (compatibles.length === 0) {
      messageMatching.textContent =
        "Aucun autre participant n'a de film en commun pour le moment.";
      return;
    }

    messageMatching.textContent =
      `${compatibles.length} utilisateur(s) trouvé(s) !`;

    compatibles.forEach((utilisateur) => {
      const carte = document.createElement("ion-card");
      const contenu = document.createElement("ion-card-content");
      const nom = document.createElement("h2");
      const taux = document.createElement("p");
      const communs = document.createElement("p");

      nom.textContent =
        `${utilisateur.prenom} ${utilisateur.nom}`.trim();

      taux.textContent =
        `❤️ ${utilisateur.taux.toFixed(1)} % de compatibilité`;

      communs.textContent =
        "🎬 Films en commun : " +
        utilisateur.filmsCommuns.join(", ");

      contenu.append(nom, taux, communs);
      carte.appendChild(contenu);
      listeMatching.appendChild(carte);
    });

  } catch (erreur) {
    console.error("Erreur lors du matching :", {
      code: erreur.code,
      message: erreur.message,
      stack: erreur.stack
    });

    messageMatching.textContent =
      "Erreur Firestore : " +
      (erreur.code || erreur.message);

    afficherNotification(
      "Erreur Firestore : " +
      (erreur.code || erreur.message),
      "danger"
    );
  }
}

btnMatching?.addEventListener("click", afficherMatching);

btnRetourMatching?.addEventListener("click", () => {
  afficherPage(catalogue);
});

 
 
 // =====================================================
 // 11. MON PROFIL
 // =====================================================

async function changerPhotoProfil() {
  if (!verifierConnexion()) return;

  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: true,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      width: 600,
      height: 600
    });

    if (!photo.webPath) {
      throw new Error("Photo introuvable.");
    }

    // Convertir la photo en fichier Blob.
    const reponse = await fetch(photo.webPath);
    const fichierPhoto = await reponse.blob();

    // Envoyer la photo vers Firebase Storage.
    const cheminPhoto = ref(
      storage,
      `photos-profil/${utilisateurConnecte.uid}/photo-profil.jpg`
    );

    await uploadBytes(cheminPhoto, fichierPhoto, {
      contentType: fichierPhoto.type || "image/jpeg"
    });

    // Récupérer l'URL de la photo.
    const urlPhoto = await getDownloadURL(cheminPhoto);

    // Enregistrer l'URL dans Firestore.
    await setDoc(
      doc(db, "users", utilisateurConnecte.uid),
      { photo: urlPhoto },
      { merge: true }
    );

    // Mettre à jour le profil en mémoire.
    profilConnecte = {
      ...profilConnecte,
      photo: urlPhoto
    };

    // Afficher immédiatement la nouvelle photo.
    const photoProfil = document.getElementById("photo-profil");

    if (photoProfil) {
      photoProfil.src = urlPhoto;
    }

    afficherNotification(
      "Photo de profil mise à jour avec succès !",
      "success"
    );

  } catch (erreur) {
    if (
      erreur.message?.toLowerCase().includes("cancel") ||
      erreur.message?.toLowerCase().includes("cancelled")
    ) {
      return;
    }

    console.error(
      "Erreur lors du changement de photo :",
      erreur
    );

    afficherNotification(
      "Impossible de modifier la photo. Vérifie Firebase Storage et les permissions.",
      "danger"
    );
  }
}


// -----------------------------------------------------
// AFFICHER LE PROFIL
// -----------------------------------------------------

async function afficherProfil() {
  if (!verifierConnexion()) return;

  try {
    const profil = await chargerProfilFirebase(
      utilisateurConnecte
    );

    if (!profil) {
      afficherNotification(
        "Profil introuvable.",
        "danger"
      );
      return;
    }

    profilConnecte = profil;

    // Afficher les informations personnelles.
    document.getElementById("profil-nom").textContent =
      profil.nom || "";

    document.getElementById("profil-prenom").textContent =
      profil.prenom || "";

    document.getElementById("profil-age").textContent =
      profil.age ?? "";

    document.getElementById("profil-email").textContent =
      profil.email || utilisateurConnecte.email || "";

    // Afficher la photo actuelle.
    const photoProfil =
      document.getElementById("photo-profil");

    photoProfil.src =
      profil.photo ||
      "https://ionicframework.com/docs/img/demos/avatar.svg";

    // -------------------------------------------------
    // BOUTON : CHANGER MA PHOTO
    // -------------------------------------------------

    let btnChangerPhoto =
      document.getElementById("btn-changer-photo");

    if (!btnChangerPhoto) {
      btnChangerPhoto =
        document.createElement("ion-button");

      btnChangerPhoto.id = "btn-changer-photo";
      btnChangerPhoto.textContent = "Changer ma photo";

      btnChangerPhoto.setAttribute("fill", "outline");
      btnChangerPhoto.setAttribute("type", "button");

      // Éviter la soumission accidentelle d'un formulaire.
      btnChangerPhoto.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          changerPhotoProfil();
        }
      );
    }

    // Positionner le bouton sous l'avatar.
    btnChangerPhoto.style.display = "flex";
    btnChangerPhoto.style.width = "fit-content";
    btnChangerPhoto.style.margin = "12px auto 20px";
    btnChangerPhoto.style.position = "relative";
    btnChangerPhoto.style.zIndex = "10";

    const avatarProfil =
      photoProfil.closest("ion-avatar");

    if (avatarProfil) {
      avatarProfil.insertAdjacentElement(
        "afterend",
        btnChangerPhoto
      );
    } else {
      photoProfil.insertAdjacentElement(
        "afterend",
        btnChangerPhoto
      );
    }

    // -------------------------------------------------
    // BOUTON : MODIFIER MON PROFIL
    // -------------------------------------------------

    let btnModifierProfil =
      document.getElementById("btn-modifier-profil");

    if (!btnModifierProfil) {
      btnModifierProfil =
        document.createElement("ion-button");

      btnModifierProfil.id = "btn-modifier-profil";
      btnModifierProfil.textContent = "Modifier mon profil";

      btnModifierProfil.setAttribute("expand", "block");
      btnModifierProfil.setAttribute("color", "primary");
      btnModifierProfil.setAttribute("type", "button");

      const boutonRetour =
        pageProfil.querySelector("#btn-retour-profil");

      if (boutonRetour) {
        boutonRetour.before(btnModifierProfil);
      } else {
        pageProfil.appendChild(btnModifierProfil);
      }

      btnModifierProfil.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          modifierProfil();
        }
      );
    }

    // Afficher la page du profil.
    afficherPage(pageProfil);

  } catch (erreur) {
    console.error(
      "Erreur de lecture du profil :",
      erreur
    );

    afficherNotification(
      "Impossible de charger le profil.",
      "danger"
    );
  }
}


// -----------------------------------------------------
// OUVRIR MON PROFIL
// -----------------------------------------------------

btnMonProfil?.addEventListener(
  "click",
  afficherProfil
);


// Modifier le nom, le prénom et l'âge.
async function modifierProfil() {
  if (!verifierConnexion()) return;

  try {
    const nouveauNom = window.prompt(
      "Entre ton nom :",
      profilConnecte.nom || ""
    );

    if (nouveauNom === null) return;

    const nouveauPrenom = window.prompt(
      "Entre ton prénom :",
      profilConnecte.prenom || ""
    );

    if (nouveauPrenom === null) return;

    const nouvelAge = window.prompt(
      "Entre ton âge :",
      String(profilConnecte.age ?? "")
    );

    if (nouvelAge === null) return;

    const nom = nouveauNom.trim();
    const prenom = nouveauPrenom.trim();
    const age = Number(nouvelAge);

    if (!nom || !prenom) {
      afficherNotification(
        "Le nom et le prénom sont obligatoires.",
        "warning"
      );
      return;
    }

    if (
      nouvelAge.trim() === "" ||
      !Number.isInteger(age) ||
      age < 1 ||
      age > 120
    ) {
      afficherNotification(
        "Entre un âge valide entre 1 et 120.",
        "warning"
      );
      return;
    }

    await setDoc(
      doc(db, "users", utilisateurConnecte.uid),
      { nom, prenom, age },
      { merge: true }
    );

    profilConnecte = {
      ...profilConnecte,
      nom,
      prenom,
      age
    };

    afficherNotification(
      "Profil modifié avec succès !",
      "success"
    );

    await afficherProfil();

  } catch (erreur) {
    console.error("Erreur de modification du profil :", erreur);

    afficherNotification(
      "Impossible de modifier le profil.",
      "danger"
    );
  }
}

btnMonProfil?.addEventListener("click", afficherProfil);


 // =====================================================
 // 12. DÉCONNEXION FIREBASE
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

  if (resultat.role !== "confirm") return;

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
// 13. INITIALISATION
// =====================================================

if (actionsUtilisateur) {
  actionsUtilisateur.hidden = true;
}

afficherPage(accueil);
