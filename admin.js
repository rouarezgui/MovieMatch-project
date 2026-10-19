import { db } from "./firebase-config.js";

import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Même version (12.0.0) que dans script.js, sinon ça plante.

// =====================================================
// OUTILS FOURNIS PAR script.js
// =====================================================

let outils = null;

export function initAdmin(options) {
  outils = options;

  document
    .getElementById("btn-ajouter-film")
    ?.addEventListener("click", ajouterFilm);
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
  const affiche = lireChamp("film-affiche");
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

  if (affiche && !/^https?:\/\/\S+$/i.test(affiche)) {
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

// =====================================================
// LECTURE DES FILMS AJOUTÉS (utilisée par le catalogue)
// =====================================================

// Retourne les films au même format que TMDB (title, poster_path,
// vote_average) pour réutiliser l'affichage existant.
export async function lireFilmsAjoutes(recherche = "") {
  try {
    const resultat = await getDocs(collection(db, "movies"));
    const motCle = recherche.trim().toLowerCase();

    return resultat.docs
      .map((d) => ({ ...d.data(), docId: d.id }))
      .filter((f) =>
        !motCle || String(f.titre || "").toLowerCase().includes(motCle)
      )
      .sort((a, b) => Number(b.id) - Number(a.id)) // les plus récents d'abord
      .map((f) => ({
        id: Number(f.id ?? f.docId),
        title: f.titre,
        poster_path: f.affiche || "",
        vote_average: f.note || 0
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