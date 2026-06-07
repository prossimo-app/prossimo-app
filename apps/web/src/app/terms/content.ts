import type { SupportedLanguage } from "@prossimo-app/localization/server";

export interface TermsSection {
  after?: readonly string[];
  bullets?: readonly string[];
  groups?: readonly {
    after?: readonly string[];
    bullets?: readonly string[];
    paragraphs: readonly string[];
    title: string;
  }[];
  id: string;
  paragraphs?: readonly string[];
  title: string;
}

interface TermsContent {
  agreement: string;
  contactEmailLabel: string;
  contentsLabel: string;
  effectiveDate: string;
  effectiveDateLabel: string;
  intro: {
    appName: string;
    beforeAppName: string;
    beforeWebsite: string;
    websiteUrl: string;
  };
  sections: readonly TermsSection[];
  title: string;
}

export const termsContent = {
  en: {
    title: "Terms of Use",
    contentsLabel: "Contents",
    effectiveDateLabel: "Effective date",
    effectiveDate: "5 June 2026",
    contactEmailLabel: "Contact email:",
    agreement: "By using Prossimo, you agree to these Terms.",
    intro: {
      beforeAppName: 'These Terms of Use ("Terms") govern your use of',
      appName: "Prossimo",
      beforeWebsite:
        '("the App", "we", "us", or "our") and the website available at',
      websiteUrl: "https://prossimo.app",
    },
    sections: [
      {
        id: "description",
        title: "1. Description of the App",
        paragraphs: [
          "Prossimo is a public transport tracking application for Torino.",
          "The App provides information such as:",
        ],
        bullets: [
          "public transport stops;",
          "routes;",
          "estimated arrivals;",
          "vehicle positions;",
          "service alerts;",
          "map-based transport information.",
        ],
        after: [
          "The App uses official public transport data sources, including GTT/5T/GTFS/GTFS-RT data, where available.",
        ],
      },
      {
        id: "free-use",
        title: "2. Free Use",
        paragraphs: [
          "Prossimo is currently provided free of charge.",
          "We may add, remove, or change features in the future. If paid features are introduced, any applicable pricing and terms will be shown clearly before purchase.",
        ],
      },
      {
        id: "independent-app",
        title: "3. Independent App and No Affiliation",
        paragraphs: [
          "Prossimo is an independent application.",
          "Unless explicitly stated otherwise, Prossimo is not affiliated with, endorsed by, sponsored by, or operated by:",
        ],
        bullets: [
          "GTT;",
          "Gruppo Torinese Trasporti;",
          "5T;",
          "the City of Torino;",
          "any public transport authority;",
          "any other official transport operator or public body.",
        ],
        after: [
          "Names, route information, stop information, and transit data may belong to their respective owners and are used only to provide public transport information to users.",
        ],
      },
      {
        id: "transit-data",
        title: "4. Transit Data and Accuracy",
        paragraphs: [
          "Prossimo provides public transport information based on available data sources.",
          "However, arrival times, vehicle positions, routes, alerts, and other transit information may be:",
        ],
        bullets: [
          "delayed;",
          "incomplete;",
          "inaccurate;",
          "unavailable;",
          "affected by technical issues;",
          "affected by changes from the transport operator or data provider.",
        ],
        after: [
          "You should not rely solely on Prossimo for time-critical travel decisions.",
          "We are not responsible for missed buses, trams, trains, appointments, connections, delays, costs, losses, or other consequences resulting from reliance on information shown in the App.",
        ],
      },
      {
        id: "location-and-maps",
        title: "5. Location and Map Features",
        paragraphs: [
          "The App may use your device location, with your permission, to show nearby stops and map-based information.",
          "Map features may rely on third-party services such as Apple Maps and Google Maps. These services are provided by their respective providers and may be subject to their own terms and privacy policies.",
        ],
      },
      {
        id: "push-notifications",
        title: "6. Push Notifications",
        paragraphs: [
          "If you enable push notifications, Prossimo may send you App-related notifications, such as transport updates or service-related messages.",
          "You can disable notifications at any time through your device settings.",
          "We do not guarantee that notifications will always be delivered, delivered on time, or reflect the latest transport conditions.",
        ],
      },
      {
        id: "user-responsibilities",
        title: "7. User Responsibilities",
        paragraphs: ["You agree not to:"],
        bullets: [
          "misuse the App;",
          "interfere with the App's operation;",
          "attempt to access systems or data without authorization;",
          "reverse engineer or copy the App except where allowed by law;",
          "use automated tools to overload, scrape, or disrupt the App;",
          "use the App for unlawful purposes;",
          "violate the rights of others.",
        ],
      },
      {
        id: "intellectual-property",
        title: "8. Intellectual Property",
        paragraphs: [
          "The App, including its design, software, interface, branding, and original content, is owned by or licensed to us and is protected by applicable intellectual property laws.",
          "Public transport data, maps, stop names, route names, operator names, and other third-party materials may belong to their respective owners.",
          "These Terms do not give you ownership of the App or any third-party data.",
        ],
      },
      {
        id: "third-party-services",
        title: "9. Third-Party Services and Data",
        paragraphs: [
          "Prossimo may depend on third-party services, infrastructure, map providers, app stores, public transport data sources, and other external systems.",
          "We are not responsible for the availability, accuracy, performance, or content of third-party services or data sources.",
        ],
        groups: [
          {
            title: "Data Attribution",
            paragraphs: [
              "Prossimo uses public transport data made available by GTT S.p.A. - Gruppo Torinese Trasporti and/or 5T, including GTFS and GTFS Real-Time data where available.",
              "Data source: GTT S.p.A. - Gruppo Torinese Trasporti.",
              'Transit data is provided by the relevant data providers on an "as is" basis. Prossimo is an independent application and is not affiliated with, endorsed by, sponsored by, or operated by GTT, 5T, the City of Torino, or any public transport authority, unless explicitly stated otherwise.',
            ],
          },
        ],
      },
      {
        id: "availability",
        title: "10. Availability of the App",
        paragraphs: [
          "We try to keep Prossimo available and reliable, but we do not guarantee that the App will always be:",
        ],
        bullets: [
          "available;",
          "uninterrupted;",
          "error-free;",
          "accurate;",
          "secure;",
          "compatible with every device or operating system.",
        ],
        after: [
          "We may modify, suspend, or discontinue all or part of the App at any time.",
        ],
      },
      {
        id: "warranties",
        title: "11. Disclaimer of Warranties",
        paragraphs: [
          'Prossimo is provided on an "as is" and "as available" basis.',
          "To the maximum extent permitted by law, we make no warranties or guarantees regarding the App, including the accuracy, completeness, reliability, availability, or suitability of transport information.",
        ],
      },
      {
        id: "liability",
        title: "12. Limitation of Liability",
        paragraphs: [
          "To the maximum extent permitted by law, we are not liable for any indirect, incidental, consequential, special, or financial damages arising from or related to your use of the App.",
          "This includes, but is not limited to:",
        ],
        bullets: [
          "missed transport;",
          "delays;",
          "missed appointments;",
          "travel disruption;",
          "financial loss;",
          "loss of data;",
          "reliance on inaccurate or unavailable information.",
        ],
        after: [
          "Nothing in these Terms limits liability where such limitation is not allowed by applicable law.",
        ],
      },
      {
        id: "changes",
        title: "13. Changes to These Terms",
        paragraphs: [
          "We may update these Terms from time to time.",
          "If we make changes, we will update the effective date above and publish the updated version in the App or on our website.",
          "Your continued use of the App after the updated Terms are published means you accept the updated Terms.",
        ],
      },
      {
        id: "governing-law",
        title: "14. Governing Law",
        paragraphs: [
          "These Terms are governed by the laws of Italy, unless mandatory consumer protection laws provide otherwise.",
        ],
      },
      {
        id: "contact",
        title: "15. Contact",
        paragraphs: ["For questions about these Terms, contact:"],
      },
    ],
  },
  it: {
    title: "Termini di utilizzo",
    contentsLabel: "Indice",
    effectiveDateLabel: "Data di entrata in vigore",
    effectiveDate: "5 giugno 2026",
    contactEmailLabel: "Email di contatto:",
    agreement: "Utilizzando Prossimo, accetti questi Termini.",
    intro: {
      beforeAppName:
        'I presenti Termini di utilizzo ("Termini") regolano l\'uso di',
      appName: "Prossimo",
      beforeWebsite:
        '("l\'App", "noi", "ci" o "nostro") e del sito web disponibile all\'indirizzo',
      websiteUrl: "https://prossimo.app",
    },
    sections: [
      {
        id: "description",
        title: "1. Descrizione dell'App",
        paragraphs: [
          "Prossimo è un'applicazione per il monitoraggio del trasporto pubblico a Torino.",
          "L'App fornisce informazioni come:",
        ],
        bullets: [
          "fermate del trasporto pubblico;",
          "percorsi;",
          "arrivi stimati;",
          "posizioni dei veicoli;",
          "avvisi di servizio;",
          "informazioni sul trasporto basate sulla mappa.",
        ],
        after: [
          "L'App utilizza fonti ufficiali di dati sul trasporto pubblico, inclusi dati GTT/5T/GTFS/GTFS-RT, ove disponibili.",
        ],
      },
      {
        id: "free-use",
        title: "2. Uso gratuito",
        paragraphs: [
          "Prossimo è attualmente fornita gratuitamente.",
          "Potremmo aggiungere, rimuovere o modificare funzionalità in futuro. Se verranno introdotte funzionalità a pagamento, eventuali prezzi e termini applicabili saranno mostrati chiaramente prima dell'acquisto.",
        ],
      },
      {
        id: "independent-app",
        title: "3. App indipendente e assenza di affiliazione",
        paragraphs: [
          "Prossimo è un'applicazione indipendente.",
          "Salvo diversa indicazione esplicita, Prossimo non è affiliata, approvata, sponsorizzata o gestita da:",
        ],
        bullets: [
          "GTT;",
          "Gruppo Torinese Trasporti;",
          "5T;",
          "la Città di Torino;",
          "qualsiasi autorità del trasporto pubblico;",
          "qualsiasi altro operatore ufficiale del trasporto o ente pubblico.",
        ],
        after: [
          "Nomi, informazioni sui percorsi, informazioni sulle fermate e dati sul trasporto possono appartenere ai rispettivi titolari e sono utilizzati solo per fornire informazioni sul trasporto pubblico agli utenti.",
        ],
      },
      {
        id: "transit-data",
        title: "4. Dati sul trasporto e accuratezza",
        paragraphs: [
          "Prossimo fornisce informazioni sul trasporto pubblico basate sulle fonti di dati disponibili.",
          "Tuttavia, orari di arrivo, posizioni dei veicoli, percorsi, avvisi e altre informazioni sul trasporto possono essere:",
        ],
        bullets: [
          "in ritardo;",
          "incomplete;",
          "inesatte;",
          "non disponibili;",
          "influenzate da problemi tecnici;",
          "influenzate da modifiche dell'operatore di trasporto o del fornitore dei dati.",
        ],
        after: [
          "Non dovresti fare affidamento esclusivamente su Prossimo per decisioni di viaggio sensibili al tempo.",
          "Non siamo responsabili per autobus, tram o treni persi, appuntamenti, coincidenze, ritardi, costi, perdite o altre conseguenze derivanti dall'affidamento alle informazioni mostrate nell'App.",
        ],
      },
      {
        id: "location-and-maps",
        title: "5. Posizione e funzionalità di mappa",
        paragraphs: [
          "L'App può utilizzare la posizione del tuo dispositivo, con il tuo consenso, per mostrare fermate nelle vicinanze e informazioni basate sulla mappa.",
          "Le funzionalità di mappa possono fare affidamento su servizi di terze parti come Apple Maps e Google Maps. Questi servizi sono forniti dai rispettivi fornitori e possono essere soggetti ai loro termini e informative sulla privacy.",
        ],
      },
      {
        id: "push-notifications",
        title: "6. Notifiche push",
        paragraphs: [
          "Se abiliti le notifiche push, Prossimo può inviarti notifiche relative all'App, come aggiornamenti sul trasporto o messaggi relativi al servizio.",
          "Puoi disattivare le notifiche in qualsiasi momento dalle impostazioni del dispositivo.",
          "Non garantiamo che le notifiche vengano sempre consegnate, consegnate puntualmente o che riflettano le condizioni di trasporto più recenti.",
        ],
      },
      {
        id: "user-responsibilities",
        title: "7. Responsabilità dell'utente",
        paragraphs: ["Accetti di non:"],
        bullets: [
          "utilizzare impropriamente l'App;",
          "interferire con il funzionamento dell'App;",
          "tentare di accedere a sistemi o dati senza autorizzazione;",
          "decompilare, disassemblare o copiare l'App salvo quanto consentito dalla legge;",
          "utilizzare strumenti automatizzati per sovraccaricare, estrarre dati o interrompere l'App;",
          "utilizzare l'App per finalità illecite;",
          "violare i diritti di altri.",
        ],
      },
      {
        id: "intellectual-property",
        title: "8. Proprietà intellettuale",
        paragraphs: [
          "L'App, inclusi design, software, interfaccia, marchio e contenuti originali, è di nostra proprietà o concessa in licenza a noi ed è protetta dalle leggi applicabili in materia di proprietà intellettuale.",
          "Dati sul trasporto pubblico, mappe, nomi delle fermate, nomi dei percorsi, nomi degli operatori e altri materiali di terze parti possono appartenere ai rispettivi titolari.",
          "Questi Termini non ti attribuiscono la proprietà dell'App o di dati di terze parti.",
        ],
      },
      {
        id: "third-party-services",
        title: "9. Servizi e dati di terze parti",
        paragraphs: [
          "Prossimo può dipendere da servizi di terze parti, infrastrutture, fornitori di mappe, app store, fonti di dati sul trasporto pubblico e altri sistemi esterni.",
          "Non siamo responsabili per disponibilità, accuratezza, prestazioni o contenuti di servizi o fonti di dati di terze parti.",
        ],
        groups: [
          {
            title: "Attribuzione dei dati",
            paragraphs: [
              "Prossimo utilizza dati sul trasporto pubblico resi disponibili da GTT S.p.A. - Gruppo Torinese Trasporti e/o 5T, inclusi dati GTFS e GTFS Real-Time ove disponibili.",
              "Fonte dei dati: GTT S.p.A. - Gruppo Torinese Trasporti.",
              'I dati sul trasporto sono forniti dai relativi fornitori di dati "così come sono". Prossimo è un\'applicazione indipendente e non è affiliata, approvata, sponsorizzata o gestita da GTT, 5T, la Città di Torino o qualsiasi autorità del trasporto pubblico, salvo diversa indicazione esplicita.',
            ],
          },
        ],
      },
      {
        id: "availability",
        title: "10. Disponibilità dell'App",
        paragraphs: [
          "Cerchiamo di mantenere Prossimo disponibile e affidabile, ma non garantiamo che l'App sia sempre:",
        ],
        bullets: [
          "disponibile;",
          "ininterrotta;",
          "priva di errori;",
          "accurata;",
          "sicura;",
          "compatibile con ogni dispositivo o sistema operativo.",
        ],
        after: [
          "Possiamo modificare, sospendere o interrompere tutta o parte dell'App in qualsiasi momento.",
        ],
      },
      {
        id: "warranties",
        title: "11. Esclusione di garanzie",
        paragraphs: [
          'Prossimo è fornita "così com\'è" e "come disponibile".',
          "Nella misura massima consentita dalla legge, non forniamo garanzie o dichiarazioni relative all'App, inclusa l'accuratezza, completezza, affidabilità, disponibilità o idoneità delle informazioni sul trasporto.",
        ],
      },
      {
        id: "liability",
        title: "12. Limitazione di responsabilità",
        paragraphs: [
          "Nella misura massima consentita dalla legge, non siamo responsabili per danni indiretti, incidentali, consequenziali, speciali o finanziari derivanti da o relativi al tuo uso dell'App.",
          "Ciò include, a titolo esemplificativo:",
        ],
        bullets: [
          "trasporto perso;",
          "ritardi;",
          "appuntamenti persi;",
          "interruzioni del viaggio;",
          "perdite finanziarie;",
          "perdita di dati;",
          "affidamento su informazioni inesatte o non disponibili.",
        ],
        after: [
          "Nulla in questi Termini limita la responsabilità quando tale limitazione non è consentita dalla legge applicabile.",
        ],
      },
      {
        id: "changes",
        title: "13. Modifiche ai presenti Termini",
        paragraphs: [
          "Possiamo aggiornare questi Termini di tanto in tanto.",
          "In caso di modifiche, aggiorneremo la data di entrata in vigore sopra indicata e pubblicheremo la versione aggiornata nell'App o sul nostro sito web.",
          "L'uso continuato dell'App dopo la pubblicazione dei Termini aggiornati implica l'accettazione dei Termini aggiornati.",
        ],
      },
      {
        id: "governing-law",
        title: "14. Legge applicabile",
        paragraphs: [
          "Questi Termini sono regolati dalle leggi italiane, salvo diversa previsione delle norme imperative a tutela dei consumatori.",
        ],
      },
      {
        id: "contact",
        title: "15. Contatti",
        paragraphs: ["Per domande su questi Termini, contatta:"],
      },
    ],
  },
} satisfies Record<SupportedLanguage, TermsContent>;
