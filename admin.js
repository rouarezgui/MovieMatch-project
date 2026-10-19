import { db } from "./firebase-config.js";

import {
  collection,
  doc,
  setDoc,
  getDocs,
  runTransaction,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Même version (12.0.0) que dans script.js, sinon ça plante.

// =====================================================
// OUTILS FOURNIS PAR script.js
// =====================================================

let outils = null;
let afficheSelectionnee = "";
let afficheModificationSelectionnee = "";
let afficheModificationActuelle = "";
let filmEnModification = null;

export function initAdmin(options) {
  outils = options;

  document
    .getElementById("btn-ajouter-film")
    ?.addEventListener("click", ajouterFilm);
  document
    .getElementById("film-photo-affiche")
    ?.addEventListener("change", choisirAffiche);
  document
    .getElementById("film-photo-affiche-modification")
    ?.addEventListener("change", choisirAfficheModification);
  document
    .getElementById("btn-enregistrer-modification-film")
    ?.addEventListener("click", enregistrerModificationFilm);
  document
    .getElementById("btn-annuler-modification-film")
    ?.addEventListener("click", annulerModificationFilm);
}

// Vérification côté interface (le vrai verrou = firestore.rules)
function estAdminLocal() {
  const profil = outils?.obtenirProfil();
  return profil?.role === "admin" && profil?.actif === true;
}

function lireChamp(id) {
  const champ = document.getElementById(id);
  return String(champ?.value ?? "").trim();
}

function viderChamps() {
  [
    "film-titre", "film-annee", "film-genre",
    "film-note", "film-affiche", "film-description"
  ].forEach((id) => {
    const champ = document.getElementById(id);
    if (champ) champ.value = "";
  });

  afficheSelectionnee = "";
  const selectionAffiche = document.getElementById("film-photo-affiche");
  if (selectionAffiche) selectionAffiche.value = "";
  const apercuAffiche = document.getElementById("apercu-affiche-film");
  if (apercuAffiche) {
    apercuAffiche.removeAttribute("src");
    apercuAffiche.hidden = true;
  }
}

function convertirAfficheEnDataUrl(fichier) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();

    lecteur.onerror = () => reject(new Error("Impossible de lire cette image."));
    lecteur.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Le fichier choisi n'est pas une image lisible."));
      image.onload = () => {
        const facteur = Math.min(1, 600 / image.width, 900 / image.height);
        const largeur = Math.round(image.width * facteur);
        const hauteur = Math.round(image.height * facteur);
        const canvas = document.createElement("canvas");
        const contexte = canvas.getContext("2d");

        if (!contexte) {
          reject(new Error("Impossible de traiter cette image."));
          return;
        }

        for (let reduction = 1; reduction <= 4; reduction++) {
          canvas.width = Math.max(1, Math.round(largeur * 0.8 ** (reduction - 1)));
          canvas.height = Math.max(1, Math.round(hauteur * 0.8 ** (reduction - 1)));
          contexte.drawImage(image, 0, 0, canvas.width, canvas.height);

          for (const qualite of [0.82, 0.72, 0.62, 0.52, 0.42]) {
            const dataUrl = canvas.toDataURL("image/jpeg", qualite);
            if (dataUrl.length <= 450000) {
              resolve(dataUrl);
              return;
            }
          }
        }

        reject(new Error("L'image est trop volumineuse après compression."));
      };
      image.src = String(lecteur.result);
    };

    lecteur.readAsDataURL(fichier);
  });
}

async function choisirAffiche(evenement) {
  const champ = evenement.currentTarget;
  const fichier = champ.files?.[0];
  const apercu = document.getElementById("apercu-affiche-film");

  if (!fichier) return;

  afficheSelectionnee = "";
  apercu.removeAttribute("src");
  apercu.hidden = true;

  if (!fichier.type.startsWith("image/")) {
    outils.notifier("Veuillez sélectionner un fichier image.", "warning");
    champ.value = "";
    return;
  }

  if (fichier.size > 8 * 1024 * 1024) {
    outils.notifier("La photo ne doit pas dépasser 8 Mo.", "warning");
    champ.value = "";
    return;
  }

  try {
    afficheSelectionnee = await convertirAfficheEnDataUrl(fichier);
    apercu.src = afficheSelectionnee;
    apercu.hidden = false;
    outils.notifier("Affiche sélectionnée.", "success");
  } catch (erreur) {
    console.error("Erreur de traitement de l'affiche :", erreur);
    afficheSelectionnee = "";
    champ.value = "";
    apercu.removeAttribute("src");
    apercu.hidden = true;
    outils.notifier(erreur.message, "danger");
  }
}

async function choisirAfficheModification(evenement) {
  const champ = evenement.currentTarget;
  const fichier = champ.files?.[0];
  const apercu = document.getElementById("apercu-affiche-film-modification");

  if (!fichier) return;

  afficheModificationSelectionnee = "";
  apercu.removeAttribute("src");
  apercu.hidden = true;

  if (!fichier.type.startsWith("image/")) {
    outils.notifier("Veuillez sélectionner un fichier image.", "warning");
    champ.value = "";
    return;
  }

  if (fichier.size > 8 * 1024 * 1024) {
    outils.notifier("La photo ne doit pas dépasser 8 Mo.", "warning");
    champ.value = "";
    return;
  }

  try {
    afficheModificationSelectionnee = await convertirAfficheEnDataUrl(fichier);
    apercu.src = afficheModificationSelectionnee;
    apercu.hidden = false;
  } catch (erreur) {
    console.error("Erreur de traitement de l'affiche :", erreur);
    champ.value = "";
    outils.notifier(erreur.message, "danger");
  }
}

// =====================================================
// AJOUT D'UN FILM
// =====================================================

async function ajouterFilm() {
  if (!estAdminLocal()) {
    outils.notifier("Accès réservé aux administrateurs.", "danger");
    return;
  }

  const titre = lireChamp("film-titre");
  const annee = Number(lireChamp("film-annee"));
  const genre = lireChamp("film-genre");
  const urlAffiche = lireChamp("film-affiche");
  const affiche = afficheSelectionnee || urlAffiche;
  const description = lireChamp("film-description");
  const noteTexte = lireChamp("film-note");
  const note = noteTexte === "" ? 0 : Number(noteTexte);

  if (!titre || !genre || !annee) {
    outils.notifier("Titre, année et genre sont obligatoires.", "warning");
    return;
  }

  if (
    !Number.isInteger(annee) ||
    annee < 1888 ||
    annee > new Date().getFullYear() + 5
  ) {
    outils.notifier("Année invalide.", "warning");
    return;
  }

  if (Number.isNaN(note) || note < 0 || note > 10) {
    outils.notifier("La note doit être comprise entre 0 et 10.", "warning");
    return;
  }

  if (urlAffiche && !afficheSelectionnee && !/^https?:\/\/\S+$/i.test(urlAffiche)) {
    outils.notifier("L'URL de l'affiche doit commencer par http(s)://", "warning");
    return;
  }

  const bouton = document.getElementById("btn-ajouter-film");
  bouton.disabled = true; // évite le double clic

  try {
    // id numérique unique : compatible avec les favoris (Number(film.id))
    // et impossible de rentrer en collision avec les ids TMDB.
    const id = Date.now();

    await setDoc(doc(db, "movies", String(id)), {
      id,
      titre,
      annee,
      genre,
      affiche,
      note,
      description,
      ajoutePar: outils.obtenirUid(),
      createdAt: serverTimestamp()
    });

    viderChamps();
    await chargerFilmsAdmin();
    outils.notifier(`« ${titre} » a été ajouté au catalogue !`, "success");
  } catch (erreur) {
    console.error("Erreur d'ajout du film :", erreur);

    outils.notifier(
      erreur.code === "permission-denied"
        ? "Action refusée : droits administrateur requis."
        : "Impossible d'ajouter le film.",
      "danger"
    );
  } finally {
    bouton.disabled = false;
  }
}

function annulerModificationFilm() {
  filmEnModification = null;
  afficheModificationSelectionnee = "";
  afficheModificationActuelle = "";
  document.getElementById("formulaire-modification-film").hidden = true;
  document.getElementById("film-photo-affiche-modification").value = "";
}

function ouvrirModificationFilm(film) {
  filmEnModification = film;
  afficheModificationSelectionnee = "";
  afficheModificationActuelle = film.affiche ?? "";

  document.getElementById("modifier-film-titre").value = film.titre ?? "";
  document.getElementById("modifier-film-annee").value = film.annee ?? "";
  document.getElementById("modifier-film-genre").value = film.genre ?? "";
  document.getElementById("modifier-film-note").value = film.note ?? "";
  document.getElementById("modifier-film-affiche").value =
    film.affiche?.startsWith("data:image/") ? "" : film.affiche ?? "";
  document.getElementById("modifier-film-description").value =
    film.description ?? "";

  const selectionAffiche = document.getElementById("film-photo-affiche-modification");
  selectionAffiche.value = "";

  const apercu = document.getElementById("apercu-affiche-film-modification");
  if (film.affiche) {
    apercu.src = film.affiche;
    apercu.hidden = false;
  } else {
    apercu.removeAttribute("src");
    apercu.hidden = true;
  }

  document.getElementById("formulaire-modification-film").hidden = false;
  document.getElementById("formulaire-modification-film")
    .scrollIntoView({ behavior: "smooth", block: "center" });
}

async function enregistrerModificationFilm() {
  if (!estAdminLocal() || !filmEnModification) {
    outils.notifier("Accès réservé aux administrateurs.", "danger");
    return;
  }

  const titre = lireChamp("modifier-film-titre");
  const anneeTexte = lireChamp("modifier-film-annee");
  const annee = Number(anneeTexte);
  const genre = lireChamp("modifier-film-genre");
  const noteTexte = lireChamp("modifier-film-note");
  const note = noteTexte === "" ? 0 : Number(noteTexte);
  const urlAffiche = lireChamp("modifier-film-affiche");
  const affiche =
    afficheModificationSelectionnee || urlAffiche || afficheModificationActuelle;
  const description = lireChamp("modifier-film-description");

  if (!titre || !genre || !anneeTexte) {
    outils.notifier("Titre, année et genre sont obligatoires.", "warning");
    return;
  }

  if (
    !Number.isInteger(annee) ||
    annee < 1888 ||
    annee > new Date().getFullYear() + 5
  ) {
    outils.notifier("Année invalide.", "warning");
    return;
  }

  if (!Number.isFinite(note) || note < 0 || note > 10) {
    outils.notifier("La note doit être comprise entre 0 et 10.", "warning");
    return;
  }

  if (
    urlAffiche &&
    !afficheModificationSelectionnee &&
    !/^https?:\/\/\S+$/i.test(urlAffiche)
  ) {
    outils.notifier("L'URL de l'affiche doit commencer par http(s)://", "warning");
    return;
  }

  const bouton = document.getElementById("btn-enregistrer-modification-film");
  bouton.disabled = true;

  try {
    await updateDoc(doc(db, "movies", filmEnModification.docId), {
      titre,
      annee,
      genre,
      affiche,
      note,
      description
    });

    annulerModificationFilm();
    await chargerFilmsAdmin();
    outils.notifier(`« ${titre} » a été modifié.`, "success");
  } catch (erreur) {
    console.error("Erreur de modification du film :", erreur);
    outils.notifier(
      erreur.code === "permission-denied"
        ? "Action refusée : droits administrateur requis."
        : "Impossible de modifier le film.",
      "danger"
    );
  } finally {
    bouton.disabled = false;
  }
}

async function supprimerFilm(film) {
  if (!estAdminLocal()) {
    outils.notifier("Accès réservé aux administrateurs.", "danger");
    return;
  }

  const alerte = document.createElement("ion-alert");
  alerte.header = "Supprimer le film";
  alerte.message = `Voulez-vous vraiment supprimer « ${film.titre || "ce film"} » ?`;
  alerte.buttons = [
    { text: "Annuler", role: "cancel" },
    { text: "Supprimer", role: "confirm" }
  ];
  document.body.appendChild(alerte);

  await alerte.present();
  const resultat = await alerte.onDidDismiss();
  alerte.remove();

  if (resultat.role !== "confirm") return;

  try {
    if (film.source === "tmdb") {
      await updateDoc(doc(db, "movies", film.docId), {
        supprime: true,
        supprimeAt: serverTimestamp(),
        supprimePar: outils.obtenirUid()
      });
    } else {
      await deleteDoc(doc(db, "movies", film.docId));
    }

    if (filmEnModification?.docId === film.docId) {
      annulerModificationFilm();
    }
    await chargerFilmsAdmin();
    outils.notifier(`« ${film.titre || "Le film"} » a été supprimé.`, "success");
  } catch (erreur) {
    console.error("Erreur de suppression du film :", erreur);
    outils.notifier(
      erreur.code === "permission-denied"
        ? "Action refusée : droits administrateur requis."
        : "Impossible de supprimer le film.",
      "danger"
    );
  }
}

export async function chargerFilmsAdmin() {
  const liste = document.getElementById("liste-films-admin");
  const message = document.getElementById("message-films-admin");
  if (!liste || !message) return;

  liste.replaceChildren();
  message.textContent = "Chargement des films...";

  try {
    const resultat = await getDocs(collection(db, "movies"));
    const films = resultat.docs
      .map((document_) => ({
        ...document_.data(),
        docId: document_.id
      }))
      .filter((film) => film.supprime !== true)
      .sort((a, b) => String(a.titre || "").localeCompare(String(b.titre || "")));

    message.textContent = films.length
      ? `${films.length} film(s) dans le catalogue`
      : "Aucun film ajouté pour le moment.";

    films.forEach((film) => {
      const item = document.createElement("article");
      item.className = "admin-film-item";

      if (film.affiche) {
        const image = document.createElement("img");
        image.src = film.affiche;
        image.alt = `Affiche de ${film.titre || "film"}`;
        image.loading = "lazy";
        item.appendChild(image);
      }

      const details = document.createElement("div");
      details.className = "admin-film-details";
      const titre = document.createElement("h3");
      titre.textContent = film.titre || "Film sans titre";
      const meta = document.createElement("p");
      meta.textContent = [
        film.annee,
        film.genre,
        film.source === "tmdb" ? "TMDB" : "Ajouté par l'admin"
      ].filter(Boolean).join(" · ");
      details.append(titre, meta);

      const actions = document.createElement("div");
      actions.className = "admin-film-actions";

      const boutonModifier = document.createElement("ion-button");
      boutonModifier.textContent = "Modifier";
      boutonModifier.setAttribute("fill", "outline");
      boutonModifier.addEventListener("click", () => ouvrirModificationFilm(film));

      const boutonSupprimer = document.createElement("ion-button");
      boutonSupprimer.textContent = "Supprimer";
      boutonSupprimer.setAttribute("color", "danger");
      boutonSupprimer.addEventListener("click", () => supprimerFilm(film));

      actions.append(boutonModifier, boutonSupprimer);
      item.append(details, actions);
      liste.appendChild(item);
    });
  } catch (erreur) {
    console.error("Erreur de chargement des films admin :", erreur);
    message.textContent = "Impossible de charger la liste des films.";
    outils.notifier("Impossible de charger les films du catalogue.", "danger");
  }
}

export async function synchroniserFilmsTMDB(filmsTMDB, uid) {
  if (filmsTMDB.length === 0) return [];

  const references = filmsTMDB.map((film) =>
    doc(db, "movies", `tmdb_${film.id}`)
  );
  const snapshots = await runTransaction(db, async (transaction) => {
    const documents = await Promise.all(
      references.map((reference) => transaction.get(reference))
    );

    documents.forEach((snapshot, index) => {
      if (snapshot.exists()) return;

      const film = filmsTMDB[index];
      const annee = Number.parseInt(film.release_date?.slice(0, 4) || "", 10);
      const affiche = film.poster_path
        ? `https://image.tmdb.org/t/p/w500${film.poster_path}`
        : "";

      transaction.set(references[index], {
        id: film.id,
        tmdbId: String(film.id),
        source: "tmdb",
        titre: String(film.title || "Film sans titre").slice(0, 200),
        annee: Number.isInteger(annee) ? annee : 0,
        genre: "",
        affiche,
        note: Number(film.vote_average || 0),
        description: String(film.overview || "").slice(0, 5000),
        ajoutePar: uid,
        createdAt: serverTimestamp()
      });
    });

    return documents;
  });

  return snapshots
    .map((snapshot, index) => {
      const donnees = snapshot.exists()
        ? snapshot.data()
        : {
            ...filmsTMDB[index],
            id: filmsTMDB[index].id,
            titre: String(filmsTMDB[index].title || "Film sans titre").slice(0, 200),
            annee: Number.parseInt(filmsTMDB[index].release_date?.slice(0, 4) || "", 10) || 0,
            genre: "",
            affiche: filmsTMDB[index].poster_path
              ? `https://image.tmdb.org/t/p/w500${filmsTMDB[index].poster_path}`
              : "",
            note: Number(filmsTMDB[index].vote_average || 0),
            description: String(filmsTMDB[index].overview || "").slice(0, 5000)
          };

      if (donnees.supprime === true) return null;

      return {
        ...filmsTMDB[index],
        ...donnees,
        title: donnees.titre,
        poster_path: donnees.affiche || "",
        vote_average: donnees.note || 0,
        overview: donnees.description || "",
        release_date: donnees.annee ? `${donnees.annee}-01-01` : ""
      };
    })
    .filter(Boolean);
}

// =====================================================
// LECTURE DES FILMS ENREGISTRÉS (ajoutés par l'admin ou importés de TMDB)
// =====================================================

export async function lireFilmsCatalogueFirebase(recherche = "") {
  try {
    const resultat = await getDocs(collection(db, "movies"));
    const motCle = recherche.trim().toLowerCase();

    return resultat.docs
      .map((d) => ({ ...d.data(), docId: d.id }))
      .filter((film) => film.supprime !== true)
      .filter((f) =>
        !motCle || String(f.titre || "").toLowerCase().includes(motCle)
      )
      .sort((a, b) => Number(b.id) - Number(a.id)) // les plus récents d'abord
      .map((f) => ({
        id: Number(f.id ?? f.docId),
        title: f.titre,
        poster_path: f.affiche || "",
        vote_average: f.note || 0,
        overview: f.description || "",
        release_date: f.annee ? `${f.annee}-01-01` : ""
      }));
  } catch (erreur) {
    console.error("Erreur de lecture des films ajoutés :", erreur);
    return []; // le catalogue TMDB continue de fonctionner
  }
}

// =====================================================
// LISTE DES UTILISATEURS + ACTIVATION / DÉSACTIVATION
// =====================================================

export async function chargerUtilisateurs() {
  const liste = document.getElementById("liste-utilisateurs");
  const message = document.getElementById("message-utilisateurs");

  liste.innerHTML = "";
  message.textContent = "Chargement des utilisateurs...";

  try {
    const resultat = await getDocs(collection(db, "users"));
    const monUid = outils.obtenirUid();
    let compteur = 0;

    resultat.forEach((document_) => {
      const u = document_.data();

      // On n'affiche ni l'admin lui-même ni les autres admins
      if (document_.id === monUid || u.role === "admin") return;

      compteur++;

      const item = document.createElement("ion-item");

      // Avatar
      const avatar = document.createElement("ion-avatar");
      avatar.slot = "start";
      const image = document.createElement("img");
      image.src =
        u.photo || "https://ionicframework.com/docs/img/demos/avatar.svg";
      image.alt = "Photo de profil";
      avatar.appendChild(image);

      // Nom + email (textContent et non innerHTML : protège du XSS)
      const label = document.createElement("ion-label");
      const nom = document.createElement("h3");
      nom.textContent = `${u.prenom ?? ""} ${u.nom ?? ""}`.trim();
      const email = document.createElement("p");
      email.textContent = u.email ?? "";
      label.append(nom, email);

      // Interrupteur actif / désactivé
      const toggle = document.createElement("ion-toggle");
      toggle.slot = "end";
      toggle.checked = u.actif === true;
      toggle.textContent = toggle.checked ? "Actif" : "Désactivé";

      let etatActuel = toggle.checked;

      toggle.addEventListener("ionChange", async (evenement) => {
        const nouvelEtat = evenement.detail.checked;

        // Ignore les changements qu'on fait nous-mêmes en code
        if (nouvelEtat === etatActuel) return;

        try {
          // On modifie UNIQUEMENT "actif" : c'est ce que les règles autorisent
          await updateDoc(doc(db, "users", document_.id), {
            actif: nouvelEtat
          });

          etatActuel = nouvelEtat;
          toggle.textContent = nouvelEtat ? "Actif" : "Désactivé";

          outils.notifier(
            nouvelEtat
              ? `Compte de ${u.prenom ?? "l'utilisateur"} réactivé.`
              : `Compte de ${u.prenom ?? "l'utilisateur"} désactivé.`,
            nouvelEtat ? "success" : "warning"
          );
        } catch (erreur) {
          console.error("Erreur de mise à jour :", erreur);
          toggle.checked = etatActuel; // on remet l'interrupteur
          outils.notifier("Action refusée ou impossible.", "danger");
        }
      });

      item.append(avatar, label, toggle);
      liste.appendChild(item);
    });

    message.textContent =
      compteur === 0
        ? "Aucun autre utilisateur pour le moment."
        : `${compteur} utilisateur(s)`;
  } catch (erreur) {
    console.error("Erreur de chargement des utilisateurs :", erreur);
    message.textContent = "Impossible de charger les utilisateurs.";
    outils.notifier("Accès refusé. Vérifie les règles Firestore.", "danger");
  }
}