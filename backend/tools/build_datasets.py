"""
SmartLearn AI - dataset builder.

Creates and cleans the CSV datasets used by the recommendation engine,
skill analyzer and roadmap generator.

Course metadata policy (important):
- Direct course URLs are only used for stable, well-known course pages.
- Platform catalogue/search pages are labelled `link_type=catalogue|search`
  and `verified=0`; the UI marks them as needing verification.
- Ratings are intentionally blank unless a verified numeric value is known.
- Durations are either published or marked as estimates. Nothing is invented
  silently.

Run:  python tools/build_datasets.py
"""
from __future__ import annotations

import csv
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATASETS = ROOT / "app" / "datasets"
DATASETS.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# SKILLS
# ---------------------------------------------------------------------------
SKILLS = [
    # slug, name, category, level, description, aliases
    ("python", "Python", "Programming", "foundational", "Write readable Python programs and scripts.", "py,python3"),
    ("sql", "SQL", "Data", "foundational", "Query and model relational data.", "structured query language"),
    ("javascript", "JavaScript", "Programming", "foundational", "Modern JavaScript for the browser and Node.", "js,es6"),
    ("typescript", "TypeScript", "Programming", "intermediate", "Typed JavaScript for large applications.", "ts"),
    ("java", "Java", "Programming", "foundational", "Object-oriented programming on the JVM.", ""),
    ("csharp", "C#", "Programming", "foundational", "C# programming for apps and games.", "c sharp,dotnet"),
    ("cpp", "C++", "Programming", "intermediate", "Systems programming with modern C++.", "c++"),
    ("r-lang", "R", "Data", "foundational", "Statistical computing and visualization in R.", "r programming"),
    ("go", "Go", "Programming", "intermediate", "Backend services and tooling in Go.", "golang"),
    ("bash", "Bash / Shell", "Programming", "foundational", "Command-line automation on Linux and macOS.", "shell,terminal,command line"),
    ("data-structures", "Data Structures", "Programming", "foundational", "Arrays, maps, trees, graphs and their trade-offs.", "dsa"),
    ("algorithms", "Algorithms", "Programming", "intermediate", "Algorithm design, complexity and correctness.", "algorithm analysis"),
    ("oop", "Object-Oriented Programming", "Programming", "foundational", "Classes, interfaces, composition and design.", "oops"),
    ("git", "Git & GitHub", "Programming", "foundational", "Version control, branching and collaboration.", "github,version control"),
    ("linux", "Linux", "Cloud & Systems", "foundational", "Navigate and administer Linux systems.", "ubuntu,unix"),
    ("testing", "Software Testing", "Programming", "intermediate", "Unit, integration and end-to-end testing.", "unit testing,pytest,jest"),
    ("system-design", "System Design", "Programming", "advanced", "Design scalable, reliable distributed systems.", "architecture"),
    ("rest-apis", "REST APIs", "Programming", "intermediate", "Design and consume HTTP JSON APIs.", "api,apis,rest"),
    ("graphql", "GraphQL", "Programming", "intermediate", "Schema-first API design and queries.", ""),
    ("websockets", "WebSockets", "Programming", "intermediate", "Real-time bidirectional communication.", "socket.io"),
    ("message-queues", "Message Queues", "Cloud & Systems", "advanced", "Asynchronous messaging with queues and streams.", "kafka,rabbitmq"),

    # Web
    ("html-css", "HTML & CSS", "Web Development", "foundational", "Semantic markup and responsive styling.", "html,css,html5,css3"),
    ("responsive-design", "Responsive Design", "Web Development", "foundational", "Mobile-first layouts and fluid interfaces.", "mobile first"),
    ("react", "React", "Web Development", "intermediate", "Component-driven user interfaces with React.", "reactjs,react.js"),
    ("nextjs", "Next.js", "Web Development", "advanced", "Full-stack React with routing and server rendering.", "next"),
    ("tailwind", "Tailwind CSS", "Web Development", "intermediate", "Utility-first CSS for design systems.", "tailwindcss"),
    ("nodejs", "Node.js", "Web Development", "intermediate", "JavaScript runtime for backend services.", "node"),
    ("express", "Express.js", "Web Development", "intermediate", "Minimal Node.js web framework.", "expressjs"),
    ("django", "Django", "Web Development", "intermediate", "Batteries-included Python web framework.", ""),
    ("fastapi", "FastAPI", "Web Development", "intermediate", "Typed, async Python APIs with automatic docs.", "fast api"),
    ("flask", "Flask", "Web Development", "intermediate", "Lightweight Python web framework.", ""),
    ("postgresql", "PostgreSQL", "Data", "intermediate", "Relational database design and administration.", "postgres,psql"),
    ("mongodb", "MongoDB", "Data", "intermediate", "Document databases and aggregation.", "mongo,nosql"),
    ("redis", "Redis", "Data", "intermediate", "In-memory caching and data structures.", "cache"),
    ("firebase", "Firebase", "Web Development", "intermediate", "Managed auth, database and hosting.", "firestore"),
    ("web-security", "Web Security", "Security", "advanced", "Secure web apps against common attacks.", "owasp,appsec"),
    ("accessibility", "Accessibility (a11y)", "Web Development", "intermediate", "Inclusive interfaces following WCAG.", "a11y,wcag"),
    ("state-management", "State Management", "Web Development", "intermediate", "Predictable client state with stores and reducers.", "redux,zustand"),
    ("frontend-performance", "Frontend Performance", "Web Development", "advanced", "Measure and optimize web performance.", "web performance,core web vitals"),
    ("design-systems", "Design Systems", "Design", "advanced", "Reusable components, tokens and guidelines.", "design system"),

    # Data & AI
    ("statistics", "Statistics", "Data", "foundational", "Descriptive and inferential statistics.", "statistical analysis"),
    ("probability", "Probability", "Data", "foundational", "Probability models and distributions.", ""),
    ("linear-algebra", "Linear Algebra", "Data", "foundational", "Vectors, matrices and transformations for ML.", "matrices"),
    ("pandas", "Pandas", "Data", "intermediate", "Tabular data manipulation in Python.", "dataframes"),
    ("numpy", "NumPy", "Data", "intermediate", "Numerical computing with arrays.", ""),
    ("data-visualization", "Data Visualization", "Data", "intermediate", "Communicate insight with charts.", "dataviz,visualisation"),
    ("machine-learning", "Machine Learning", "AI", "intermediate", "Supervised and unsupervised learning.", "ml,machine learning"),
    ("scikit-learn", "Scikit-learn", "AI", "intermediate", "Train and evaluate ML models in Python.", "sklearn"),
    ("model-evaluation", "Model Evaluation", "AI", "intermediate", "Cross-validation, metrics and error analysis.", "metrics"),
    ("feature-engineering", "Feature Engineering", "AI", "intermediate", "Create informative features from raw data.", "feature selection"),
    ("deep-learning", "Deep Learning", "AI", "advanced", "Neural networks for perception and language.", "neural networks"),
    ("pytorch", "PyTorch", "AI", "advanced", "Deep learning research and production with PyTorch.", "torch"),
    ("tensorflow", "TensorFlow", "AI", "advanced", "Deep learning with the TensorFlow ecosystem.", "keras"),
    ("nlp", "Natural Language Processing", "AI", "advanced", "Process and model human language.", "natural language processing"),
    ("computer-vision", "Computer Vision", "AI", "advanced", "Image classification, detection and segmentation.", "cv,opencv"),
    ("transformers", "Transformers", "AI", "advanced", "Attention-based models and LLM fine-tuning.", "llm,large language models,hugging face"),
    ("mlops", "MLOps", "AI", "advanced", "Deploy, monitor and maintain ML systems.", "ml ops,model deployment"),
    ("data-ethics", "Data & AI Ethics", "AI", "intermediate", "Fairness, privacy and responsible AI.", "responsible ai"),
    ("data-storytelling", "Data Storytelling", "Data", "intermediate", "Turn analysis into decisions and narratives.", "storytelling"),
    ("ab-testing", "A/B Testing", "Data", "intermediate", "Design and analyze controlled experiments.", "experimentation"),
    ("analytics", "Product Analytics", "Data", "intermediate", "Measure product behaviour and funnels.", "product analytics"),
    ("power-bi", "Power BI", "Data", "intermediate", "Build business intelligence dashboards.", "powerbi"),
    ("tableau", "Tableau", "Data", "intermediate", "Visual analytics and dashboards in Tableau.", ""),
    ("dashboarding", "Dashboarding", "Data", "intermediate", "Design effective operational dashboards.", "dashboards"),
    ("big-data", "Big Data", "Data", "advanced", "Distributed processing for large datasets.", "hadoop"),
    ("spark", "Apache Spark", "Data", "advanced", "Large-scale data processing with Spark.", "pyspark"),
    ("time-series", "Time Series", "Data", "advanced", "Forecasting and temporal modeling.", "forecasting"),

    # Cloud, DevOps & Security
    ("cloud-aws", "AWS Cloud", "Cloud & Systems", "intermediate", "Core AWS compute, storage and networking.", "amazon web services,aws"),
    ("azure", "Microsoft Azure", "Cloud & Systems", "intermediate", "Azure cloud services and administration.", ""),
    ("gcp", "Google Cloud", "Cloud & Systems", "intermediate", "Google Cloud Platform fundamentals.", "google cloud"),
    ("docker", "Docker", "Cloud & Systems", "intermediate", "Containerize and run applications.", "containers"),
    ("kubernetes", "Kubernetes", "Cloud & Systems", "advanced", "Orchestrate containers at scale.", "k8s"),
    ("cicd", "CI/CD", "Cloud & Systems", "intermediate", "Automated build, test and deployment pipelines.", "continuous integration,github actions"),
    ("terraform", "Terraform", "Cloud & Systems", "advanced", "Infrastructure as code with Terraform.", "iac"),
    ("ansible", "Ansible", "Cloud & Systems", "advanced", "Configuration management and automation.", ""),
    ("monitoring", "Monitoring & Observability", "Cloud & Systems", "advanced", "Metrics, logs, traces and alerting.", "observability,prometheus"),
    ("networking", "Computer Networking", "Cloud & Systems", "foundational", "TCP/IP, DNS, routing and network security.", "tcp/ip,ccna"),
    ("security-fundamentals", "Security Fundamentals", "Security", "foundational", "Confidentiality, integrity, availability and risk.", "cybersecurity,infosec"),
    ("ethical-hacking", "Ethical Hacking", "Security", "advanced", "Authorized penetration testing and exploitation.", "penetration testing,pentest"),
    ("cryptography", "Cryptography", "Security", "advanced", "Encryption, hashing and secure protocols.", "encryption"),
    ("siem", "SIEM", "Security", "advanced", "Security information and event management.", "splunk,sentinel"),
    ("incident-response", "Incident Response", "Security", "advanced", "Detect, contain and recover from incidents.", "dfir"),
    ("digital-forensics", "Digital Forensics", "Security", "advanced", "Evidence collection and forensic analysis.", "forensics"),
    ("cloud-security", "Cloud Security", "Security", "advanced", "Secure cloud identities, networks and data.", ""),
    ("threat-modeling", "Threat Modeling", "Security", "advanced", "Systematically identify design threats.", "stride"),
    ("grc", "Governance, Risk & Compliance", "Security", "advanced", "Security policy, audit and compliance.", "compliance,risk"),
    ("security-architecture", "Security Architecture", "Security", "advanced", "Design defense-in-depth systems.", "zero trust"),
    ("threat-intelligence", "Threat Intelligence", "Security", "advanced", "Collect and operationalize threat data.", "cti"),
    ("cost-optimization", "Cloud Cost Optimization", "Cloud & Systems", "advanced", "Control and optimize cloud spend.", "finops"),

    # Design
    ("ux-research", "UX Research", "Design", "intermediate", "Understand users through interviews and studies.", "user research"),
    ("ui-design", "UI Design", "Design", "intermediate", "Visual hierarchy, layout and interface craft.", "user interface design"),
    ("figma", "Figma", "Design", "intermediate", "Design and prototype interfaces in Figma.", ""),
    ("wireframing", "Wireframing", "Design", "foundational", "Sketch structural layouts before visual design.", "wireframes"),
    ("prototyping", "Prototyping", "Design", "intermediate", "Create testable interactive prototypes.", "prototype"),
    ("interaction-design", "Interaction Design", "Design", "advanced", "Design flows, feedback and micro-interactions.", "ixd"),
    ("usability-testing", "Usability Testing", "Design", "advanced", "Plan and run usability sessions.", "user testing"),
    ("information-architecture", "Information Architecture", "Design", "advanced", "Organize content and navigation.", "ia"),
    ("branding", "Branding", "Design", "intermediate", "Build coherent brand identities.", "brand identity"),
    ("motion-design", "Motion Design", "Design", "advanced", "Animate interfaces with purpose.", "animation"),
    ("design-portfolio", "Design Portfolio", "Design", "intermediate", "Present design work with clear case studies.", "portfolio"),
    ("canva", "Canva", "Design", "foundational", "Fast visual content creation in Canva.", ""),

    # Business, marketing, product
    ("digital-marketing", "Digital Marketing", "Business", "foundational", "Plan and execute digital acquisition strategy.", "online marketing"),
    ("seo", "SEO", "Business", "intermediate", "Improve organic search visibility.", "search engine optimization"),
    ("content-marketing", "Content Marketing", "Business", "intermediate", "Create content that attracts and retains users.", "content strategy"),
    ("google-analytics", "Google Analytics", "Business", "intermediate", "Measure website and campaign performance.", "ga4,web analytics"),
    ("social-media-marketing", "Social Media Marketing", "Business", "intermediate", "Build and measure social channels.", "smm"),
    ("email-marketing", "Email Marketing", "Business", "intermediate", "Lifecycle campaigns and list health.", "newsletters"),
    ("paid-advertising", "Paid Advertising", "Business", "intermediate", "Run search and social ad campaigns.", "ppc,google ads,meta ads"),
    ("conversion-optimization", "Conversion Optimization", "Business", "advanced", "Improve funnel conversion with evidence.", "cro"),
    ("marketing-automation", "Marketing Automation", "Business", "advanced", "Automate lifecycle messaging and scoring.", "hubspot automation"),
    ("copywriting", "Copywriting", "Business", "intermediate", "Persuasive, clear marketing copy.", "ad copy"),
    ("customer-segmentation", "Customer Segmentation", "Business", "intermediate", "Group customers for targeted strategy.", "segmentation"),
    ("business-analysis", "Business Analysis", "Business", "foundational", "Turn business needs into requirements.", "ba"),
    ("requirements-gathering", "Requirements Gathering", "Business", "intermediate", "Elicit and document stakeholder needs.", "elicitation"),
    ("process-modeling", "Process Modeling", "Business", "intermediate", "Map and improve business processes.", "bpmn"),
    ("agile-scrum", "Agile & Scrum", "Business", "foundational", "Iterative delivery with Scrum ceremonies.", "agile,scrum"),
    ("jira", "Jira", "Business", "intermediate", "Track work with boards, backlogs and sprints.", "atlassian"),
    ("stakeholder-management", "Stakeholder Management", "Business", "intermediate", "Align and communicate with stakeholders.", "stakeholders"),
    ("product-strategy", "Product Strategy", "Business", "advanced", "Choose markets, problems and product bets.", "product management"),
    ("roadmapping", "Product Roadmapping", "Business", "intermediate", "Sequence outcomes and communicate plans.", "roadmap"),
    ("user-stories", "User Stories", "Business", "intermediate", "Write clear, testable product requirements.", "backlog"),
    ("leadership", "Leadership", "Soft Skills", "advanced", "Lead teams and develop people.", "team lead"),
    ("go-to-market", "Go-to-Market", "Business", "advanced", "Launch products with positioning and channels.", "gtm"),
    ("pricing-strategy", "Pricing Strategy", "Business", "advanced", "Design pricing and packaging.", "pricing"),
    ("project-management", "Project Management", "Business", "intermediate", "Plan scope, schedule, risk and delivery.", "pmp"),
    ("excel", "Excel", "Data", "foundational", "Spreadsheet analysis, formulas and pivots.", "spreadsheets"),
    ("finance-fundamentals", "Finance Fundamentals", "Business", "foundational", "Financial statements, budgeting and ROI.", "finance"),

    # Engineering
    ("engineering-mechanics", "Engineering Mechanics", "Engineering", "foundational", "Statics and dynamics of structures and machines.", "statics,dynamics"),
    ("autocad", "AutoCAD", "Engineering", "foundational", "2D drafting and technical drawings.", "cad"),
    ("materials-science", "Materials Science", "Engineering", "intermediate", "Material properties and selection.", "material science"),
    ("thermodynamics", "Thermodynamics", "Engineering", "intermediate", "Energy, heat and thermodynamic cycles.", "thermo"),
    ("solidworks", "SolidWorks", "Engineering", "intermediate", "3D parametric CAD modeling.", "3d cad"),
    ("manufacturing-processes", "Manufacturing Processes", "Engineering", "intermediate", "Casting, machining and additive manufacturing.", "manufacturing"),
    ("matlab", "MATLAB", "Engineering", "intermediate", "Numerical computing and simulation.", "simulink"),
    ("fea", "Finite Element Analysis", "Engineering", "advanced", "Simulate stress and deformation with FEA.", "finite element"),
    ("machine-design", "Machine Design", "Engineering", "advanced", "Design mechanical components and assemblies.", "mechanical design"),
    ("fluid-mechanics", "Fluid Mechanics", "Engineering", "intermediate", "Fluid statics, dynamics and flow analysis.", "fluids"),
    ("gdt", "GD&T", "Engineering", "advanced", "Geometric dimensioning and tolerancing.", "geometric tolerancing"),
    ("product-design", "Product Design Engineering", "Engineering", "advanced", "Design manufacturable products.", "dfm"),
    ("cad-simulation", "CAD Simulation", "Engineering", "advanced", "Validate designs with CAD simulation tools.", "simulation"),
    ("surveying", "Surveying", "Engineering", "foundational", "Measure land and prepare site data.", "land survey"),
    ("structural-analysis", "Structural Analysis", "Engineering", "intermediate", "Analyze beams, frames and trusses.", "structures"),
    ("concrete-design", "Concrete Design", "Engineering", "advanced", "Reinforced concrete member design.", "rcc"),
    ("soil-mechanics", "Soil Mechanics", "Engineering", "intermediate", "Geotechnical properties and foundations.", "geotech"),
    ("steel-design", "Steel Design", "Engineering", "advanced", "Design steel structural members.", "steel structures"),
    ("transportation-engineering", "Transportation Engineering", "Engineering", "advanced", "Highway and traffic system design.", "highways"),
    ("construction-management", "Construction Management", "Engineering", "advanced", "Plan and control construction projects.", "construction"),
    ("earthquake-engineering", "Earthquake Engineering", "Engineering", "advanced", "Seismic design and resilience.", "seismic"),
    ("sustainable-design", "Sustainable Design", "Engineering", "advanced", "Low-impact engineering decisions.", "green building"),
    ("circuit-analysis", "Circuit Analysis", "Engineering", "foundational", "Analyze electrical circuits and networks.", "circuits"),
    ("electronics", "Electronics", "Engineering", "intermediate", "Analog and digital electronic systems.", "electronic devices"),
    ("power-systems", "Power Systems", "Engineering", "intermediate", "Generation, transmission and distribution.", "power engineering"),
    ("control-systems", "Control Systems", "Engineering", "intermediate", "Feedback, stability and controllers.", "control theory"),
    ("embedded-systems", "Embedded Systems", "Engineering", "advanced", "Microcontroller-based system design.", "microcontrollers"),
    ("plc", "PLC & Automation", "Engineering", "advanced", "Industrial automation and PLC programming.", "scada"),
    ("signal-processing", "Signal Processing", "Engineering", "advanced", "Analyze and filter signals.", "dsp"),
    ("renewable-energy", "Renewable Energy", "Engineering", "intermediate", "Solar, wind and storage systems.", "solar,wind"),
    ("electric-machines", "Electric Machines", "Engineering", "advanced", "Motors, generators and drives.", "machines"),
    ("smart-grids", "Smart Grids", "Engineering", "advanced", "Modern grid automation and integration.", "grid"),
    ("iot", "Internet of Things", "Engineering", "advanced", "Connected devices and telemetry.", "iot"),
    ("safety-standards", "Engineering Safety Standards", "Engineering", "advanced", "Codes, standards and safe design practice.", "codes"),

    # Cross-functional / soft
    ("problem-solving", "Problem Solving", "Soft Skills", "foundational", "Structured diagnosis and solution design.", "analytical thinking"),
    ("communication", "Communication", "Soft Skills", "foundational", "Clear written and verbal communication.", "english communication"),
    ("presentation", "Presentation Skills", "Soft Skills", "intermediate", "Present ideas with confidence and clarity.", "public speaking"),
    ("teamwork", "Teamwork", "Soft Skills", "foundational", "Collaborate effectively in teams.", "collaboration"),
    ("time-management", "Time Management", "Soft Skills", "foundational", "Plan and protect focused study time.", "productivity"),
    ("critical-thinking", "Critical Thinking", "Soft Skills", "intermediate", "Evaluate evidence and assumptions.", "reasoning"),
    ("research-methods", "Research Methods", "Soft Skills", "intermediate", "Design studies and evaluate sources.", "research"),
    ("academic-writing", "Academic Writing", "Soft Skills", "intermediate", "Write structured academic work.", "technical writing"),
    ("interview-preparation", "Interview Preparation", "Soft Skills", "intermediate", "Prepare for technical and behavioural interviews.", "interview"),
    ("professional-ethics", "Professional Ethics", "Soft Skills", "intermediate", "Ethical decision making at work.", "workplace ethics"),
    ("management", "Management Fundamentals", "Business", "foundational", "Plan, organize and lead organizational work.", "management basics"),
    ("image-processing", "Image Processing", "Engineering", "advanced", "Process and analyze digital images.", "digital image processing"),
]

skill_rows = [
    {
        "skill_id": s,
        "skill_name": name,
        "category": cat,
        "level": level,
        "description": desc,
        "aliases": aliases,
    }
    for s, name, cat, level, desc, aliases in SKILLS
]
SKILL_NAMES = {s[0]: s[1] for s in SKILLS}

# ---------------------------------------------------------------------------
# SKILL PREREQUISITES
# ---------------------------------------------------------------------------
PREREQS = [
    ("pandas", "python"), ("numpy", "python"), ("scikit-learn", "python"),
    ("scikit-learn", "machine-learning"), ("scikit-learn", "numpy"), ("scikit-learn", "pandas"),
    ("machine-learning", "statistics"), ("machine-learning", "python"),
    ("model-evaluation", "machine-learning"), ("feature-engineering", "pandas"),
    ("deep-learning", "machine-learning"), ("pytorch", "deep-learning"), ("tensorflow", "deep-learning"),
    ("nlp", "deep-learning"), ("computer-vision", "deep-learning"), ("transformers", "nlp"),
    ("mlops", "machine-learning"), ("mlops", "docker"), ("mlops", "cicd"),
    ("data-visualization", "pandas"), ("data-storytelling", "data-visualization"),
    ("ab-testing", "statistics"), ("time-series", "statistics"), ("spark", "python"),
    ("react", "javascript"), ("react", "html-css"), ("nextjs", "react"), ("tailwind", "html-css"),
    ("typescript", "javascript"), ("nodejs", "javascript"), ("express", "nodejs"),
    ("fastapi", "python"), ("django", "python"), ("flask", "python"),
    ("postgresql", "sql"), ("mongodb", "sql"), ("redis", "system-design"),
    ("rest-apis", "python"), ("graphql", "rest-apis"), ("testing", "javascript"),
    ("system-design", "rest-apis"), ("system-design", "postgresql"), ("system-design", "testing"),
    ("docker", "linux"), ("kubernetes", "docker"), ("cicd", "git"), ("terraform", "cloud-aws"),
    ("ansible", "linux"), ("monitoring", "docker"), ("cloud-aws", "networking"),
    ("cloud-security", "cloud-aws"), ("cloud-security", "security-fundamentals"),
    ("ethical-hacking", "networking"), ("ethical-hacking", "linux"), ("ethical-hacking", "security-fundamentals"),
    ("cryptography", "security-fundamentals"), ("siem", "security-fundamentals"),
    ("incident-response", "security-fundamentals"), ("digital-forensics", "incident-response"),
    ("threat-modeling", "security-fundamentals"), ("security-architecture", "threat-modeling"),
    ("grc", "security-fundamentals"), ("threat-intelligence", "security-fundamentals"),
    ("ux-research", "communication"), ("ui-design", "wireframing"), ("figma", "ui-design"),
    ("prototyping", "figma"), ("interaction-design", "prototyping"), ("usability-testing", "ux-research"),
    ("design-systems", "ui-design"), ("information-architecture", "ux-research"),
    ("digital-marketing", "communication"), ("seo", "digital-marketing"), ("seo", "content-marketing"),
    ("google-analytics", "digital-marketing"), ("paid-advertising", "digital-marketing"),
    ("conversion-optimization", "ab-testing"), ("marketing-automation", "email-marketing"),
    ("business-analysis", "communication"), ("requirements-gathering", "business-analysis"),
    ("process-modeling", "business-analysis"), ("agile-scrum", "business-analysis"),
    ("stakeholder-management", "communication"), ("product-strategy", "business-analysis"),
    ("roadmapping", "product-strategy"), ("user-stories", "requirements-gathering"),
    ("project-management", "agile-scrum"), ("finance-fundamentals", "excel"),
    ("structural-analysis", "engineering-mechanics"), ("concrete-design", "structural-analysis"),
    ("steel-design", "structural-analysis"), ("soil-mechanics", "engineering-mechanics"),
    ("fea", "solidworks"), ("machine-design", "engineering-mechanics"), ("machine-design", "materials-science"),
    ("fluid-mechanics", "engineering-mechanics"), ("gdt", "solidworks"),
    ("autocad", "engineering-mechanics"), ("solidworks", "autocad"),
    ("electronics", "circuit-analysis"), ("power-systems", "circuit-analysis"),
    ("control-systems", "circuit-analysis"), ("embedded-systems", "electronics"),
    ("electric-machines", "circuit-analysis"), ("plc", "control-systems"),
    ("signal-processing", "control-systems"), ("smart-grids", "power-systems"),
    ("iot", "embedded-systems"), ("construction-management", "project-management"),
]
skill_prereq_rows = [
    {"skill_id": child, "prerequisite_skill_id": parent, "strength": "required"}
    for child, parent in PREREQS
]

# ---------------------------------------------------------------------------
# COURSES
# ---------------------------------------------------------------------------
def C(cid, title, skills, category, difficulty, platform, url, hours, price, language,
      prerequisites="", link_type="direct", verified=1, note="", learning_type="Video",
      certificate=1, desc="", duration_estimate=1, price_note=""):
    return {
        "course_id": cid,
        "title": title,
        "description": desc or title,
        "skills": "|".join(skills),
        "category": category,
        "difficulty": difficulty,
        "platform": platform,
        "url": url,
        "link_type": link_type,
        "duration_hours": hours,
        "duration_is_estimate": duration_estimate,
        "price_type": price,
        "price_usd": "",
        "price_note": price_note,
        "language": language,
        "prerequisites": "|".join([p for p in prerequisites.split("|") if p]),
        "certificate": certificate,
        "rating": "",
        "rating_count": "",
        "verified": verified,
        "verification_note": note,
        "learning_type": learning_type,
        "last_checked": "2026-10-31",
    }


COURSES = [
    # ----- Harvard, MIT, Google, Microsoft and The Odin Project (official) -----
    C("cs50-python", "CS50's Introduction to Programming with Python", ["python", "problem-solving", "testing"], "Programming", "beginner", "Harvard University", "https://cs50.harvard.edu/python/", None, "Free", "English", note="Official Harvard OpenCourseWare course; optional verified certificate through edX", learning_type="Practical", certificate=0, desc="Python programming with lectures, exercises and a final project."),
    C("cs50-sql", "CS50's Introduction to Databases with SQL", ["sql", "postgresql"], "Data", "beginner", "Harvard University", "https://cs50.harvard.edu/sql/", None, "Free", "English", note="Official Harvard OpenCourseWare course; optional verified certificate through edX", learning_type="Practical", certificate=0, desc="Relational database design, SQL queries, normalization, indexes and database integration."),
    C("mit-intro-python", "Introduction to Computer Science and Programming in Python", ["python", "algorithms", "data-structures"], "Programming", "beginner", "MIT OpenCourseWare", "https://ocw.mit.edu/courses/6-0001-introduction-to-computer-science-and-programming-in-python-fall-2016/", None, "Free", "English", note="Official MIT OpenCourseWare course page", learning_type="Video", certificate=0, desc="Introductory programming and computational problem solving using Python, with lectures and assignments."),
    C("google-python-class", "Google's Python Class", ["python", "problem-solving"], "Programming", "intermediate", "Google", "https://developers.google.com/edu/python", None, "Free", "English", note="Official Google Developers class; designed for learners with some programming experience", learning_type="Practical", certificate=0, desc="Python written lessons, lecture videos and coding exercises covering core language concepts."),
    C("microsoft-ai-apps-agents", "Get started with AI applications and agents on Azure", ["azure", "python", "nlp", "machine-learning"], "AI", "beginner", "Microsoft Learn", "https://learn.microsoft.com/en-us/training/paths/get-started-ai-apps-agents/", None, "Free", "English", "python", note="Official Microsoft Learn path; 7 modules", learning_type="Practical", certificate=0, desc="Build introductory AI workloads including generative AI, text analysis, speech, computer vision and knowledge retrieval."),
    C("odin-foundations", "The Odin Project - Foundations", ["html-css", "javascript", "git", "bash"], "Web Development", "beginner", "The Odin Project", "https://www.theodinproject.com/paths/foundations/courses/foundations", None, "Free", "English", note="Official open-source Foundations course", learning_type="Practical", certificate=0, desc="Hands-on introduction to web development tools and the foundations for building websites."),

    # ----- freeCodeCamp (direct, open curriculum) -----
    C("fcc-responsive-web", "Responsive Web Design Certification", ["html-css", "responsive-design", "accessibility"], "Web Development", "beginner", "freeCodeCamp", "https://www.freecodecamp.org/learn/2022/responsive-web-design/", 300, "Free", "English", "", note="Official freeCodeCamp curriculum page", learning_type="Practical", desc="Build responsive websites with semantic HTML, modern CSS, flexbox and grid."),
    C("fcc-js-algorithms", "JavaScript Algorithms and Data Structures", ["javascript", "data-structures", "algorithms", "problem-solving"], "Programming", "beginner", "freeCodeCamp", "https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures-v8/", 300, "Free", "English", "", note="Official freeCodeCamp curriculum page", learning_type="Practical", desc="Learn JavaScript fundamentals, ES6, data structures and algorithmic thinking."),
    C("fcc-frontend-libraries", "Front End Development Libraries", ["react", "state-management", "frontend-performance", "tailwind"], "Web Development", "intermediate", "freeCodeCamp", "https://www.freecodecamp.org/learn/front-end-development-libraries/", 300, "Free", "English", "javascript|html-css", note="Official freeCodeCamp curriculum page", learning_type="Practical", desc="Build single-page apps with React, state management and front-end tooling."),
    C("fcc-backend-apis", "Back End Development and APIs", ["nodejs", "express", "mongodb", "rest-apis"], "Web Development", "intermediate", "freeCodeCamp", "https://www.freecodecamp.org/learn/back-end-development-and-apis/", 300, "Free", "English", "javascript", note="Official freeCodeCamp curriculum page", learning_type="Practical", desc="Create REST APIs with Node.js, Express and MongoDB."),
    C("fcc-relational-databases", "Relational Database Certification", ["sql", "postgresql", "bash", "git"], "Data", "beginner", "freeCodeCamp", "https://www.freecodecamp.org/learn/relational-database/", 300, "Free", "English", "", note="Official freeCodeCamp curriculum page", learning_type="Practical", desc="Learn SQL, PostgreSQL, Bash and Git by building database projects."),
    C("fcc-scientific-python", "Scientific Computing with Python", ["python", "data-structures", "problem-solving"], "Programming", "beginner", "freeCodeCamp", "https://www.freecodecamp.org/learn/scientific-computing-with-python/", 300, "Free", "English", "", note="Official freeCodeCamp curriculum page", learning_type="Practical", desc="Learn Python fundamentals through algorithms and scientific computing projects."),
    C("fcc-data-analysis", "Data Analysis with Python", ["python", "pandas", "numpy", "data-visualization"], "Data", "intermediate", "freeCodeCamp", "https://www.freecodecamp.org/learn/data-analysis-with-python/", 300, "Free", "English", "python", note="Official freeCodeCamp curriculum page", learning_type="Practical", desc="Analyze data with Pandas, NumPy and Matplotlib."),
    C("fcc-machine-learning", "Machine Learning with Python", ["machine-learning", "tensorflow", "nlp", "model-evaluation"], "AI", "intermediate", "freeCodeCamp", "https://www.freecodecamp.org/learn/machine-learning-with-python/", 300, "Free", "English", "python|statistics", note="Official freeCodeCamp curriculum page", learning_type="Practical", desc="Hands-on TensorFlow projects covering regression, classification, NLP and reinforcement learning."),
    C("fcc-information-security", "Information Security Certification", ["security-fundamentals", "cryptography", "web-security", "python"], "Security", "intermediate", "freeCodeCamp", "https://www.freecodecamp.org/learn/information-security/", 300, "Free", "English", "python", note="Official freeCodeCamp curriculum page", learning_type="Practical", desc="Study security principles, cryptography and secure web applications."),
    C("fcc-data-visualization", "Data Visualization Certification", ["data-visualization", "javascript", "dashboarding"], "Data", "intermediate", "freeCodeCamp", "https://www.freecodecamp.org/learn/data-visualization/", 300, "Free", "English", "javascript", note="Official freeCodeCamp curriculum page", learning_type="Practical", desc="Visualize data with D3 and build interactive dashboards."),

    # ----- Kaggle Learn (direct) -----
    C("kaggle-python", "Python", ["python", "problem-solving"], "Programming", "beginner", "Kaggle", "https://www.kaggle.com/learn/python", 5, "Free", "English", "", note="Official Kaggle Learn course", learning_type="Reading", desc="Fast hands-on introduction to Python syntax and data types."),
    C("kaggle-pandas", "Pandas", ["pandas", "data-visualization"], "Data", "beginner", "Kaggle", "https://www.kaggle.com/learn/pandas", 4, "Free", "English", "python", note="Official Kaggle Learn course", learning_type="Practical", desc="Data manipulation and cleaning with Pandas DataFrames."),
    C("kaggle-intro-ml", "Intro to Machine Learning", ["machine-learning", "scikit-learn", "model-evaluation"], "AI", "beginner", "Kaggle", "https://www.kaggle.com/learn/intro-to-machine-learning", 4, "Free", "English", "python", note="Official Kaggle Learn course", learning_type="Practical", desc="Build and validate first models with scikit-learn."),
    C("kaggle-intermediate-ml", "Intermediate Machine Learning", ["machine-learning", "feature-engineering", "model-evaluation"], "AI", "intermediate", "Kaggle", "https://www.kaggle.com/learn/intermediate-machine-learning", 4, "Free", "English", "machine-learning", note="Official Kaggle Learn course", learning_type="Practical", desc="Handle missing data, categorical variables, leakage and pipelines."),
    C("kaggle-data-viz", "Data Visualization", ["data-visualization", "data-storytelling"], "Data", "beginner", "Kaggle", "https://www.kaggle.com/learn/data-visualization", 4, "Free", "English", "python", note="Official Kaggle Learn course", learning_type="Practical", desc="Create clear visualizations with Seaborn."),
    C("kaggle-feature-engineering", "Feature Engineering", ["feature-engineering", "machine-learning"], "AI", "intermediate", "Kaggle", "https://www.kaggle.com/learn/feature-engineering", 4, "Free", "English", "pandas", note="Official Kaggle Learn course", learning_type="Practical", desc="Create stronger features from dates, categories and text."),
    C("kaggle-sql", "Intro to SQL", ["sql", "big-data"], "Data", "beginner", "Kaggle", "https://www.kaggle.com/learn/intro-to-sql", 4, "Free", "English", "", note="Official Kaggle Learn course", learning_type="Practical", desc="Query big datasets with SQL."),
    C("kaggle-advanced-sql", "Advanced SQL", ["sql", "analytics"], "Data", "intermediate", "Kaggle", "https://www.kaggle.com/learn/advanced-sql", 4, "Free", "English", "sql", note="Official Kaggle Learn course", learning_type="Practical", desc="Joins, analytical functions and query optimization."),
    C("kaggle-deep-learning", "Intro to Deep Learning", ["deep-learning", "tensorflow"], "AI", "intermediate", "Kaggle", "https://www.kaggle.com/learn/intro-to-deep-learning", 4, "Free", "English", "python", note="Official Kaggle Learn course", learning_type="Practical", desc="Build neural networks with TensorFlow and Keras."),
    C("kaggle-computer-vision", "Computer Vision", ["computer-vision", "deep-learning"], "AI", "advanced", "Kaggle", "https://www.kaggle.com/learn/computer-vision", 4, "Free", "English", "deep-learning", note="Official Kaggle Learn course", learning_type="Practical", desc="Image classification and augmentation with CNNs."),
    C("kaggle-nlp", "Natural Language Processing", ["nlp", "deep-learning"], "AI", "advanced", "Kaggle", "https://www.kaggle.com/learn/natural-language-processing", 3, "Free", "English", "deep-learning", note="Official Kaggle Learn course", learning_type="Practical", desc="Text preprocessing, embeddings and NLP models."),
    C("kaggle-time-series", "Time Series", ["time-series", "analytics"], "Data", "advanced", "Kaggle", "https://www.kaggle.com/learn/time-series", 4, "Free", "English", "statistics", note="Official Kaggle Learn course", learning_type="Practical", desc="Forecasting with trend, seasonality and linear models."),

    # ----- Google / Coursera (stable official pages) -----
    C("google-ml-crash", "Machine Learning Crash Course", ["machine-learning", "model-evaluation", "feature-engineering"], "AI", "intermediate", "Google", "https://developers.google.com/machine-learning/crash-course", 15, "Free", "English", "statistics", note="Official Google Developers course", learning_type="Reading", desc="Google's fast-paced practical introduction to machine learning."),
    C("google-data-analytics", "Google Data Analytics Professional Certificate", ["excel", "sql", "data-visualization", "dashboarding", "data-storytelling"], "Data", "beginner", "Coursera", "https://www.coursera.org/professional-certificates/google-data-analytics", 180, "Paid", "English", "", note="Official Coursera program page", learning_type="Video", desc="Eight-course program covering the full data analysis process."),
    C("google-ux-design", "Google UX Design Professional Certificate", ["ux-research", "wireframing", "figma", "prototyping", "usability-testing"], "Design", "beginner", "Coursera", "https://www.coursera.org/professional-certificates/google-ux-design", 200, "Paid", "English", "", note="Official Coursera program page", learning_type="Video", desc="End-to-end UX process with portfolio projects."),
    C("google-project-management", "Google Project Management Professional Certificate", ["project-management", "agile-scrum", "stakeholder-management", "process-modeling"], "Business", "beginner", "Coursera", "https://www.coursera.org/professional-certificates/google-project-management", 150, "Paid", "English", "", note="Official Coursera program page", learning_type="Video", desc="Practical project management foundations and Agile delivery."),
    C("google-cybersecurity", "Google Cybersecurity Professional Certificate", ["security-fundamentals", "linux", "siem", "incident-response", "networking"], "Security", "beginner", "Coursera", "https://www.coursera.org/professional-certificates/google-cybersecurity", 180, "Paid", "English", "", note="Official Coursera program page", learning_type="Video", desc="Entry-level cybersecurity skills with hands-on labs."),
    C("google-advanced-analytics", "Google Advanced Data Analytics Professional Certificate", ["python", "statistics", "machine-learning", "data-visualization"], "Data", "intermediate", "Coursera", "https://www.coursera.org/professional-certificates/google-advanced-data-analytics", 180, "Paid", "English", "excel", note="Official Coursera program page", learning_type="Video", desc="Advanced analytics, regression and machine learning with Python."),
    C("coursera-python", "Python for Everybody Specialization", ["python", "data-structures", "sql"], "Programming", "beginner", "Coursera", "https://www.coursera.org/specializations/python", 120, "Paid", "English", "", note="Official Coursera program page", learning_type="Video", desc="Beginner-friendly Python specialization from the University of Michigan."),
    C("coursera-ml", "Machine Learning Specialization", ["machine-learning", "statistics", "model-evaluation"], "AI", "beginner", "Coursera", "https://www.coursera.org/specializations/machine-learning-introduction", 90, "Paid", "English", "python", note="Official Coursera program page", learning_type="Video", desc="Andrew Ng's foundational machine learning specialization."),
    C("coursera-deep-learning", "Deep Learning Specialization", ["deep-learning", "nlp", "computer-vision", "tensorflow"], "AI", "advanced", "Coursera", "https://www.coursera.org/specializations/deep-learning", 120, "Paid", "English", "machine-learning", note="Official Coursera program page", learning_type="Video", desc="Five-course deep learning specialization by DeepLearning.AI."),
    C("coursera-html-css-js", "HTML, CSS and JavaScript for Web Developers", ["html-css", "javascript", "responsive-design"], "Web Development", "beginner", "Coursera", "https://www.coursera.org/learn/html-css-javascript-for-web-developers", 40, "Paid", "English", "", note="Official Coursera course page", learning_type="Video", desc="Build responsive web pages from Johns Hopkins University."),
    C("coursera-ibm-data-science", "IBM Data Science Professional Certificate", ["python", "sql", "machine-learning", "data-visualization", "pandas"], "Data", "beginner", "Coursera", "https://www.coursera.org/professional-certificates/ibm-data-science", 300, "Paid", "English", "", note="Official Coursera program page", learning_type="Video", desc="Python, SQL, data science methodology and applied capstone."),
    C("coursera-ibm-devops", "IBM DevOps and Software Engineering Professional Certificate", ["docker", "kubernetes", "cicd", "agile-scrum", "git"], "Cloud & Systems", "intermediate", "Coursera", "https://www.coursera.org/professional-certificates/devops-and-software-engineering", 300, "Paid", "English", "linux", note="Official Coursera program page", learning_type="Video", desc="DevOps culture, CI/CD, containers and Kubernetes."),
    C("coursera-google-it", "Google IT Support Professional Certificate", ["networking", "linux", "security-fundamentals", "problem-solving"], "Cloud & Systems", "beginner", "Coursera", "https://www.coursera.org/professional-certificates/google-it-support", 180, "Paid", "English", "", note="Official Coursera program page", learning_type="Video", desc="IT fundamentals, networking, Linux and troubleshooting."),
    C("coursera-meta-frontend", "Meta Front-End Developer Professional Certificate", ["html-css", "javascript", "react", "responsive-design", "git"], "Web Development", "beginner", "Coursera", "https://www.coursera.org/professional-certificates/meta-front-end-developer", 300, "Paid", "English", "", note="Official Coursera program page", learning_type="Video", desc="Front-end development with React and a portfolio capstone."),
    C("coursera-meta-backend", "Meta Back-End Developer Professional Certificate", ["python", "django", "rest-apis", "postgresql", "git"], "Web Development", "intermediate", "Coursera", "https://www.coursera.org/professional-certificates/meta-back-end-developer", 300, "Paid", "English", "python", note="Official Coursera program page", learning_type="Video", desc="Backend development with Python, Django and APIs."),
    C("coursera-aws-cloud", "AWS Cloud Technology Consultant Professional Certificate", ["cloud-aws", "cloud-security", "cost-optimization"], "Cloud & Systems", "intermediate", "Coursera", "https://www.coursera.org/professional-certificates/aws-cloud-technology-consultant", 120, "Paid", "English", "networking", note="Official Coursera program page", learning_type="Video", desc="AWS cloud fundamentals and consulting scenarios."),
    C("coursera-ai-everyone", "AI For Everyone", ["data-ethics", "machine-learning", "product-strategy"], "AI", "beginner", "Coursera", "https://www.coursera.org/learn/ai-for-everyone", 12, "Paid", "English", "", note="Official Coursera course page", learning_type="Video", desc="Non-technical introduction to AI strategy and responsible AI."),
    C("coursera-accounting", "Introduction to Financial Accounting", ["finance-fundamentals", "excel"], "Business", "beginner", "Coursera", "https://www.coursera.org/learn/wharton-accounting", 20, "Paid", "English", "", note="Official Coursera course page", learning_type="Video", desc="Read financial statements and understand accounting fundamentals."),

    # ----- Other verified open courses -----
    C("fso-fullstack", "Full Stack Open", ["react", "nodejs", "express", "mongodb", "testing", "cicd", "typescript"], "Web Development", "intermediate", "University of Helsinki", "https://fullstackopen.com/en/", 250, "Free", "English", "javascript", note="Official Full Stack Open course site", learning_type="Practical", desc="Modern full-stack development with React, Node and testing."),
    C("odin-fullstack", "The Odin Project - Full Stack JavaScript", ["html-css", "javascript", "react", "nodejs", "postgresql", "git"], "Web Development", "beginner", "The Odin Project", "https://www.theodinproject.com/paths/full-stack-javascript", 400, "Free", "English", "", note="Official Odin Project path", learning_type="Practical", desc="Open-source project-based full-stack curriculum."),
    C("mdn-learn-web", "MDN Learn Web Development", ["html-css", "javascript", "accessibility", "web-security"], "Web Development", "beginner", "MDN", "https://developer.mozilla.org/en-US/docs/Learn_web_development", 80, "Free", "English", "", note="Official MDN curriculum", learning_type="Reading", desc="Authoritative web development learning pathway from Mozilla."),
    C("fastai-course", "Practical Deep Learning for Coders", ["deep-learning", "pytorch", "computer-vision", "nlp"], "AI", "advanced", "fast.ai", "https://course.fast.ai/", 60, "Free", "English", "python|machine-learning", note="Official fast.ai course site", learning_type="Video", desc="Top-down practical deep learning with PyTorch."),
    C("huggingface-nlp", "Hugging Face NLP Course", ["nlp", "transformers", "deep-learning"], "AI", "advanced", "Hugging Face", "https://huggingface.co/learn/nlp-course", 40, "Free", "English", "python", note="Official Hugging Face course", learning_type="Reading", desc="Transformers, fine-tuning and the Hugging Face ecosystem."),
    C("mit-linear-algebra", "Linear Algebra 18.06", ["linear-algebra", "statistics"], "Data", "intermediate", "MIT OpenCourseWare", "https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/", 60, "Free", "English", "", note="Official MIT OpenCourseWare course", learning_type="Video", desc="Gilbert Strang's linear algebra course with video lectures."),
    C("mit-algorithms", "Introduction to Algorithms 6.006", ["algorithms", "data-structures"], "Programming", "advanced", "MIT OpenCourseWare", "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/", 50, "Free", "English", "python", note="Official MIT OpenCourseWare course", learning_type="Video", desc="Algorithm design and analysis with implementation."),
    C("tryhackme-paths", "TryHackMe Cyber Security Learning Paths", ["ethical-hacking", "security-fundamentals", "incident-response", "siem"], "Security", "intermediate", "TryHackMe", "https://tryhackme.com/paths", 120, "Freemium", "English", "networking", link_type="catalogue", verified=0, note="Official paths catalogue; choose the current path", learning_type="Practical", desc="Hands-on guided cybersecurity labs and learning paths."),
    C("nptel-catalogue", "NPTEL Engineering & Computing Courses", ["python", "machine-learning", "sql", "structural-analysis", "circuit-analysis", "thermodynamics", "management"], "Engineering", "intermediate", "NPTEL", "https://nptel.ac.in/courses", None, "Free", "English", "", link_type="catalogue", verified=0, note="Official NPTEL catalogue; select a current semester course", learning_type="Video", desc="IIT/IISc course catalogue spanning engineering, computing and management."),
    C("swayam-catalogue", "SWAYAM National Course Catalogue", ["python", "data-visualization", "business-analysis", "matlab", "communication"], "Engineering", "beginner", "SWAYAM", "https://swayam.gov.in/", None, "Free", "English", "", link_type="catalogue", verified=0, note="Official SWAYAM catalogue; select a current course", learning_type="Video", desc="Government of India course catalogue from universities and institutes."),
    C("aws-skillbuilder", "AWS Skill Builder", ["cloud-aws", "cloud-security", "cost-optimization"], "Cloud & Systems", "intermediate", "AWS", "https://skillbuilder.aws/", None, "Freemium", "English", "", link_type="catalogue", verified=0, note="Official AWS learning catalogue", learning_type="Video", desc="AWS-authored digital courses and labs."),
    C("ms-learn", "Microsoft Learn Training Catalogue", ["azure", "cloud-security", "security-fundamentals", "power-bi"], "Cloud & Systems", "beginner", "Microsoft Learn", "https://learn.microsoft.com/en-us/training/", None, "Free", "English", "", link_type="catalogue", verified=0, note="Official Microsoft training catalogue", learning_type="Reading", desc="Free guided paths for Azure, data and security."),
    C("hubspot-academy", "HubSpot Academy Courses", ["digital-marketing", "content-marketing", "email-marketing", "marketing-automation"], "Business", "beginner", "HubSpot Academy", "https://academy.hubspot.com/courses", None, "Free", "English", "", link_type="catalogue", verified=0, note="Official HubSpot Academy catalogue", learning_type="Video", desc="Inbound marketing, content, email and automation certifications."),
    C("google-digital-garage", "Google Digital Garage - Fundamentals of Digital Marketing", ["digital-marketing", "seo", "social-media-marketing", "google-analytics"], "Business", "beginner", "Google", "https://learndigital.withgoogle.com/digitalgarage", 40, "Free", "English", "", note="Official Google Digital Garage course", learning_type="Video", desc="Accredited introduction to digital marketing."),
    C("semrush-academy", "Semrush Academy", ["seo", "content-marketing", "paid-advertising", "analytics"], "Business", "intermediate", "Semrush", "https://www.semrush.com/academy/", None, "Free", "English", "", link_type="catalogue", verified=0, note="Official Semrush Academy catalogue", learning_type="Video", desc="Search, content and advertising courses with certifications."),
    C("meta-blueprint", "Meta Blueprint", ["social-media-marketing", "paid-advertising", "copywriting", "customer-segmentation"], "Business", "intermediate", "Meta", "https://www.facebook.com/business/learn", None, "Free", "English", "", link_type="catalogue", verified=0, note="Official Meta Blueprint catalogue", learning_type="Video", desc="Meta advertising and social media marketing training."),
    C("canva-design-school", "Canva Design School", ["canva", "branding", "motion-design", "content-marketing"], "Design", "beginner", "Canva", "https://www.canva.com/designschool/", None, "Free", "English", "", link_type="catalogue", verified=0, note="Official Canva Design School catalogue", learning_type="Video", desc="Practical visual design, branding and presentation skills."),
    C("figma-resources", "Figma Resource Library", ["figma", "ui-design", "design-systems", "prototyping"], "Design", "intermediate", "Figma", "https://www.figma.com/resource-library/", None, "Free", "English", "", link_type="catalogue", verified=0, note="Official Figma resource library", learning_type="Reading", desc="Figma guides, templates and design systems resources."),
    C("idf-courses", "Interaction Design Foundation Courses", ["ux-research", "interaction-design", "usability-testing", "information-architecture"], "Design", "intermediate", "Interaction Design Foundation", "https://www.interaction-design.org/courses", None, "Paid", "English", "", link_type="catalogue", verified=0, note="Official IxDF course catalogue", learning_type="Reading", desc="University-level UX and interaction design courses."),
    C("scrum-org", "Scrum.org Resources", ["agile-scrum", "user-stories", "roadmapping", "stakeholder-management"], "Business", "beginner", "Scrum.org", "https://www.scrum.org/resources", None, "Free", "English", "", link_type="catalogue", verified=0, note="Official Scrum.org resource library", learning_type="Reading", desc="Scrum guides, assessments and learning resources."),
    C("atlassian-agile", "Atlassian Agile Coach", ["agile-scrum", "jira", "user-stories", "roadmapping"], "Business", "beginner", "Atlassian", "https://www.atlassian.com/agile", None, "Free", "English", "", note="Official Atlassian Agile Coach", learning_type="Reading", desc="Agile, Scrum and Jira practices from Atlassian."),
    C("pmi-learning", "PMI Learning & Certification Resources", ["project-management", "leadership", "stakeholder-management", "pricing-strategy"], "Business", "advanced", "PMI", "https://www.pmi.org/learning", None, "Paid", "English", "project-management", link_type="catalogue", verified=0, note="Official PMI learning catalogue", learning_type="Video", desc="Professional project and program management development."),
    C("nng-articles", "Nielsen Norman Group UX Articles", ["ux-research", "usability-testing", "interaction-design", "information-architecture"], "Design", "intermediate", "Nielsen Norman Group", "https://www.nngroup.com/articles/", None, "Free", "English", "", link_type="catalogue", verified=0, note="Official NN/g article library", learning_type="Reading", desc="Evidence-based UX research and usability guidance."),
    C("khan-statistics", "Khan Academy - Statistics and Probability", ["statistics", "probability"], "Data", "beginner", "Khan Academy", "https://www.khanacademy.org/math/statistics-probability", 30, "Free", "English", "", note="Official Khan Academy course", learning_type="Video", desc="Free statistics and probability curriculum with practice."),
    C("autodesk-learning", "Autodesk Learning", ["autocad", "cad-simulation", "product-design"], "Engineering", "beginner", "Autodesk", "https://www.autodesk.com/learning", None, "Free", "English", "", link_type="catalogue", verified=0, note="Official Autodesk learning catalogue", learning_type="Video", desc="AutoCAD, Fusion 360 and design workflows."),
    C("solidworks-tutorials", "SOLIDWORKS Tutorials", ["solidworks", "fea", "gdt", "machine-design"], "Engineering", "intermediate", "Dassault Systèmes", "https://www.solidworks.com/sw/resources/solidworks-tutorials.htm", None, "Free", "English", "", link_type="catalogue", verified=0, note="Official SOLIDWORKS tutorial catalogue", learning_type="Practical", desc="Official 3D CAD tutorials and certification prep."),
    C("matlab-academy", "MATLAB Academy", ["matlab", "control-systems", "signal-processing", "image-processing"], "Engineering", "intermediate", "MathWorks", "https://matlabacademy.mathworks.com/", 20, "Free", "English", "", link_type="catalogue", verified=0, note="Official MathWorks training catalogue", learning_type="Practical", desc="Hands-on MATLAB and Simulink courses."),
    C("cisco-netacad", "Cisco Networking Academy", ["networking", "security-fundamentals", "iot", "linux"], "Cloud & Systems", "beginner", "Cisco Networking Academy", "https://www.netacad.com/courses/cybersecurity", None, "Free", "English", "", link_type="catalogue", verified=0, note="Official Cisco NetAcad course catalogue", learning_type="Video", desc="Networking, cybersecurity and IoT fundamentals."),
    C("salesforce-trailhead", "Salesforce Trailhead", ["business-analysis", "stakeholder-management", "analytics", "leadership"], "Business", "beginner", "Salesforce", "https://trailhead.salesforce.com/", None, "Free", "English", "", link_type="catalogue", verified=0, note="Official Trailhead catalogue", learning_type="Practical", desc="Hands-on business, CRM and analytics modules."),
    C("ppc-udemy-topic", "Udemy Web Development Courses", ["html-css", "javascript", "react", "nodejs", "typescript"], "Web Development", "beginner", "Udemy", "https://www.udemy.com/topic/web-development/", None, "Paid", "English", "", link_type="catalogue", verified=0, note="Official Udemy topic catalogue; prices vary", learning_type="Video", desc="Large marketplace of project-based web development courses."),
    C("udemy-python", "Udemy Python Courses", ["python", "django", "flask", "fastapi"], "Programming", "beginner", "Udemy", "https://www.udemy.com/topic/python/", None, "Paid", "English", "", link_type="catalogue", verified=0, note="Official Udemy topic catalogue; prices vary", learning_type="Video", desc="Marketplace Python courses from beginner to advanced."),
    C("udemy-sql", "Udemy SQL Courses", ["sql", "postgresql", "mongodb"], "Data", "beginner", "Udemy", "https://www.udemy.com/topic/sql/", None, "Paid", "English", "", link_type="catalogue", verified=0, note="Official Udemy topic catalogue; prices vary", learning_type="Video", desc="SQL and database courses for all levels."),
    C("udemy-docker-k8s", "Udemy Docker & Kubernetes Courses", ["docker", "kubernetes", "cicd", "monitoring"], "Cloud & Systems", "intermediate", "Udemy", "https://www.udemy.com/topic/docker/", None, "Paid", "English", "linux", link_type="catalogue", verified=0, note="Official Udemy topic catalogue; prices vary", learning_type="Video", desc="Container and orchestration courses."),
    C("udemy-cyber", "Udemy Ethical Hacking Courses", ["ethical-hacking", "web-security", "cryptography", "incident-response"], "Security", "advanced", "Udemy", "https://www.udemy.com/topic/ethical-hacking/", None, "Paid", "English", "networking", link_type="catalogue", verified=0, note="Official Udemy topic catalogue; prices vary", learning_type="Video", desc="Offensive security and penetration testing courses."),
    C("udemy-excel", "Udemy Excel Courses", ["excel", "dashboarding", "finance-fundamentals", "analytics"], "Data", "beginner", "Udemy", "https://www.udemy.com/topic/excel/", None, "Paid", "English", "", link_type="catalogue", verified=0, note="Official Udemy topic catalogue; prices vary", learning_type="Video", desc="Spreadsheet, dashboard and financial modeling courses."),
    C("udemy-autocad", "Udemy AutoCAD Courses", ["autocad", "solidworks", "gdt"], "Engineering", "beginner", "Udemy", "https://www.udemy.com/topic/autocad/", None, "Paid", "English", "", link_type="catalogue", verified=0, note="Official Udemy topic catalogue; prices vary", learning_type="Video", desc="Drafting and CAD courses for engineering students."),
    C("youtube-python", "YouTube - Python Full Course Search", ["python", "data-structures"], "Programming", "beginner", "YouTube", "https://www.youtube.com/results?search_query=python+full+course", None, "Free", "English", "", link_type="search", verified=0, note="YouTube search results; verify the creator and edition", learning_type="Video", desc="Curated search for current full-length Python courses."),
    C("youtube-ml", "YouTube - Machine Learning Full Course Search", ["machine-learning", "scikit-learn", "deep-learning"], "AI", "intermediate", "YouTube", "https://www.youtube.com/results?search_query=machine+learning+full+course", None, "Free", "English", "python", link_type="search", verified=0, note="YouTube search results; verify the creator and edition", learning_type="Video", desc="Current full-length machine learning courses on YouTube."),
]

# Ensure the recommendation engine has coverage for every career skill,
# using honest platform search/catalogue links where no direct open course is
# available. These are explicitly unverified and duration is unknown.
SEARCH_COVERAGE = {
    "design-thinking": ("Coursera", ["ui-design", "ux-research", "prototyping"]),
    "branding": ("Coursera", ["branding", "copywriting", "design-portfolio"]),
    "finance": ("Coursera", ["finance-fundamentals", "excel", "pricing-strategy"]),
    "business": ("Coursera", ["business-analysis", "requirements-gathering", "process-modeling"]),
    "product": ("Coursera", ["product-strategy", "roadmapping", "user-stories", "agile-scrum"]),
    "marketing": ("Coursera", ["digital-marketing", "seo", "google-analytics", "conversion-optimization"]),
    "structures": ("Coursera", ["structural-analysis", "concrete-design", "steel-design", "earthquake-engineering"]),
    "geotech": ("Coursera", ["soil-mechanics", "surveying", "construction-management", "sustainable-design"]),
    "mechanical": ("Coursera", ["engineering-mechanics", "thermodynamics", "fluid-mechanics", "manufacturing-processes"]),
    "cad": ("Coursera", ["autocad", "solidworks", "fea", "product-design"]),
    "electrical": ("Coursera", ["circuit-analysis", "electronics", "power-systems", "electric-machines"]),
    "automation": ("Coursera", ["plc", "embedded-systems", "iot", "smart-grids"]),
    "soft-skills": ("Coursera", ["communication", "presentation", "teamwork", "critical-thinking", "time-management"]),
    "career": ("Coursera", ["interview-preparation", "professional-ethics", "leadership", "academic-writing"]),
    "research": ("Coursera", ["research-methods", "academic-writing", "critical-thinking", "data-ethics"]),
    "cloud": ("Coursera", ["cloud-aws", "azure", "gcp", "kubernetes", "terraform"]),
    "security-advanced": ("Coursera", ["threat-modeling", "security-architecture", "grc", "threat-intelligence"]),
    "data-advanced": ("Coursera", ["big-data", "spark", "time-series", "mlops"]),
    "software": ("Coursera", ["system-design", "testing", "rest-apis", "graphql"]),
    "mobile": ("Coursera", ["react", "firebase", "ui-design", "testing"]),
    "game": ("Coursera", ["csharp", "cpp", "oop", "computer-vision"]),
}

for key, (platform, skill_list) in SEARCH_COVERAGE.items():
    COURSES.append(
        C(
            f"catalogue-{key}",
            f"{platform} {key.replace('-', ' ').title()} Course Catalogue Search",
            skill_list,
            "Catalogue",
            "intermediate",
            platform,
            f"https://www.coursera.org/search?query={key.replace('-', '+')}",
            None,
            "Paid",
            "English",
            "",
            link_type="search",
            verified=0,
            note="Official platform search page; course, price and duration must be verified before enrolling",
            learning_type="Video",
            certificate=0,
            desc=f"Search current {platform} courses covering {', '.join(SKILL_NAMES[s] for s in skill_list)}. The platform page is the source of truth for price, duration and availability.",
        )
    )

# Extra engineering/marketing platform catalogue entries that add non-Coursera
# options for students who prefer NPTEL/SWAYAM or other providers.
for key, skill_list in {
    "structural": ["structural-analysis", "concrete-design", "steel-design"],
    "thermal": ["thermodynamics", "fluid-mechanics"],
    "electronics": ["circuit-analysis", "electronics", "power-systems"],
    "manufacturing": ["manufacturing-processes", "materials-science", "machine-design"],
    "management": ["project-management", "construction-management", "sustainable-design"],
}.items():
    COURSES.append(
        C(
            f"swayam-{key}",
            f"SWAYAM Search - {key.title()} Engineering",
            skill_list,
            "Engineering",
            "intermediate",
            "SWAYAM",
            f"https://swayam.gov.in/explorer?searchText={key}",
            None,
            "Free",
            "English",
            "",
            link_type="search",
            verified=0,
            note="Official SWAYAM search page; confirm the current semester offering",
            learning_type="Video",
            certificate=0,
            desc="Government of India course search for engineering topics.",
        )
    )

# ---------------------------------------------------------------------------
# PROJECTS
# ---------------------------------------------------------------------------
PROJECTS = [
    ("proj-python-cli", "Personal Finance CLI", "Build a command-line app that imports transactions, categorizes spending and exports a monthly report.", "all", "python|problem-solving|git", "beginner", 8, "mini", "CSV import, category rules, tests, README"),
    ("proj-data-dashboard", "Campus Placement Dashboard", "Clean a placement dataset and build an interactive dashboard showing trends by branch and year.", "data-analyst", "pandas|data-visualization|dashboarding|statistics", "intermediate", 16, "major", "Cleaned dataset, 5+ charts, insight summary"),
    ("proj-skill-gap", "Skill Gap Explorer", "Collect job postings, extract required skills and compare them with a student's current skills.", "data-scientist", "python|nlp|pandas|data-visualization", "intermediate", 20, "major", "Scraper/API, skill extraction, gap report"),
    ("proj-ml-forecast", "Demand Forecasting Model", "Forecast monthly product demand with time-series features and compare against a naive baseline.", "data-scientist", "pandas|scikit-learn|time-series|model-evaluation", "advanced", 24, "major", "Feature pipeline, validation, error analysis"),
    ("proj-recommender", "Course Recommender", "Build a content-based recommender using TF-IDF and cosine similarity, then evaluate top-k relevance.", "machine-learning-engineer", "python|scikit-learn|pandas|numpy", "intermediate", 18, "major", "Similarity model, evaluation, API"),
    ("proj-churn", "Customer Churn Prediction", "Train, explain and deploy a churn classifier with a FastAPI scoring endpoint.", "machine-learning-engineer", "scikit-learn|fastapi|mlops|docker", "advanced", 30, "major", "Model card, API, Docker image"),
    ("proj-cv-classifier", "Image Classifier App", "Fine-tune a CNN on a small image dataset and serve predictions through a web app.", "machine-learning-engineer", "pytorch|computer-vision|deep-learning|fastapi", "advanced", 30, "major", "Training notebook, API, demo"),
    ("proj-react-dashboard", "Learning Analytics Dashboard", "Create a responsive React dashboard with charts, filters and API integration.", "frontend-developer", "react|tailwind|data-visualization|typescript", "intermediate", 20, "major", "Responsive UI, loading states, tests"),
    ("proj-fullstack", "Study Group Platform", "Build a full-stack app with JWT auth, PostgreSQL and role-based group management.", "full-stack-developer", "react|fastapi|postgresql|rest-apis|docker", "advanced", 40, "major", "Auth, CRUD, tests, deployment"),
    ("proj-ecommerce-api", "E-commerce API", "Design a versioned REST API with products, carts, orders and payment simulation.", "backend-developer", "fastapi|postgresql|rest-apis|testing|docker", "intermediate", 25, "major", "OpenAPI docs, tests, Docker"),
    ("proj-devops-pipeline", "CI/CD Pipeline for a Web App", "Containerize an app and automate tests, builds and deployment with GitHub Actions.", "cloud-devops-engineer", "docker|cicd|git|linux|cloud-aws", "intermediate", 18, "major", "Pipeline config, rollback plan"),
    ("proj-k8s", "Kubernetes Deployment Lab", "Deploy a multi-service app to Kubernetes with health checks, autoscaling and monitoring.", "cloud-devops-engineer", "kubernetes|docker|monitoring|terraform", "advanced", 28, "major", "Manifests, dashboards, runbook"),
    ("proj-security-audit", "Web App Security Audit", "Perform an authorized OWASP-based review of a deliberately vulnerable app and write a remediation report.", "cybersecurity-analyst", "web-security|ethical-hacking|threat-modeling|incident-response", "advanced", 24, "major", "Findings, severity, fixes"),
    ("proj-siem", "SIEM Detection Lab", "Ingest sample logs, build detections and document an incident timeline.", "cybersecurity-analyst", "siem|incident-response|networking|linux", "advanced", 22, "major", "Detection rules, timeline, report"),
    ("proj-ux-case", "End-to-End UX Case Study", "Research, wireframe, prototype and usability-test a campus service, then present the case study.", "ui-ux-designer", "ux-research|wireframing|figma|prototyping|usability-testing", "intermediate", 25, "major", "Research notes, prototype, test findings"),
    ("proj-design-system", "Mini Design System", "Create reusable tokens and components with documentation and accessibility checks.", "ui-ux-designer", "design-systems|figma|accessibility|ui-design", "advanced", 20, "major", "Tokens, components, usage guide"),
    ("proj-marketing", "Launch Campaign for a Student Club", "Plan a multi-channel campaign with audience research, content, budget and measurable goals.", "digital-marketing-specialist", "digital-marketing|seo|social-media-marketing|google-analytics|copywriting", "intermediate", 18, "major", "Strategy, assets, analytics plan"),
    ("proj-seo-audit", "SEO and Analytics Audit", "Audit a small website, fix on-page issues and build a GA4 measurement plan.", "digital-marketing-specialist", "seo|google-analytics|content-marketing|email-marketing", "intermediate", 16, "major", "Audit, fixes, dashboard"),
    ("proj-ba-process", "Process Improvement Case", "Map a real college process, identify bottlenecks and propose a measurable redesign.", "business-analyst", "business-analysis|process-modeling|requirements-gathering|stakeholder-management", "intermediate", 15, "major", "As-is/to-be maps, requirements"),
    ("proj-pm-roadmap", "Product Roadmap for a Campus App", "Run discovery, write user stories and create a prioritized roadmap with success metrics.", "product-manager", "product-strategy|roadmapping|user-stories|analytics|agile-scrum", "intermediate", 20, "major", "PRD, roadmap, metrics"),
    ("proj-mech-cad", "Geared Assembly Design", "Model a small geared assembly in SOLIDWORKS, run a basic FEA check and produce drawings.", "mechanical-design-engineer", "solidworks|machine-design|fea|gdt|autocad", "advanced", 30, "major", "3D assembly, analysis, drawings"),
    ("proj-thermo", "Thermodynamic Cycle Analysis", "Model a Rankine or refrigeration cycle, compare efficiency and present design recommendations.", "mechanical-design-engineer", "thermodynamics|matlab|engineering-mechanics", "intermediate", 18, "major", "Model, plots, recommendations"),
    ("proj-structural", "Structural Analysis of a Footbridge", "Model a pedestrian footbridge, check load cases and design key members.", "civil-engineer", "structural-analysis|concrete-design|autocad|construction-management", "advanced", 30, "major", "Analysis, drawings, calculation report"),
    ("proj-construction", "Construction Schedule Simulation", "Plan a small building project with cost, schedule, risk and sustainability considerations.", "civil-engineer", "construction-management|surveying|sustainable-design|project-management", "intermediate", 20, "major", "Schedule, cost estimate, risk register"),
    ("proj-circuit", "Smart Home Circuit Prototype", "Design and simulate a sensor-driven lighting circuit, then document the safety checks.", "electrical-engineer", "circuit-analysis|electronics|embedded-systems|iot", "intermediate", 22, "major", "Schematic, simulation, prototype plan"),
    ("proj-renewable", "Solar Microgrid Feasibility", "Estimate load, size a solar-plus-storage system and analyze payback.", "electrical-engineer", "renewable-energy|power-systems|matlab|sustainable-design", "advanced", 24, "major", "Load study, sizing, financial model"),
    ("proj-portfolio", "Personal Portfolio Website", "Design and build a responsive portfolio with project case studies and accessible navigation.", "all", "html-css|javascript|git|responsive-design|accessibility", "beginner", 15, "mini", "Deployed site, source code"),
    ("proj-interview", "Career Readiness Portfolio", "Package projects, résumé, STAR stories and a study plan for target roles.", "all", "interview-preparation|presentation|communication|professional-ethics", "beginner", 12, "mini", "Résumé, portfolio, mock interview"),
]
project_rows = [
    {
        "project_id": p[0], "title": p[1], "description": p[2], "career_role": p[3],
        "skills": p[4], "difficulty": p[5], "duration_hours": p[6], "project_type": p[7],
        "deliverables": p[8],
        "github_url": "", "reference_url": "",
    }
    for p in PROJECTS
]

# ---------------------------------------------------------------------------
# CAREER ROLES
# ---------------------------------------------------------------------------
def role(rid, title, category, desc, required, core, advanced, phases, phase_skills, onet, esco, demand, keywords):
    row = {
        "role_id": rid, "title": title, "category": category, "description": desc,
        "required_skills": "|".join(required), "core_skills": "|".join(core),
        "advanced_skills": "|".join(advanced),
        "phase_titles": "|".join(phases), "onet_code": onet, "esco_uri": esco,
        "demand_outlook": demand, "keywords": keywords,
    }
    for i in range(6):
        row[f"phase{i+1}_skills"] = "|".join(phase_skills[i]) if i < len(phase_skills) else ""
    return row


CAREERS = [
    role("data-scientist", "Data Scientist", "Data & AI",
         "Turn messy data into models and decisions, from exploration to production insight.",
         ["python", "sql", "statistics", "pandas", "machine-learning", "scikit-learn", "data-visualization", "communication"],
         ["python", "sql", "statistics", "pandas", "machine-learning"],
         ["deep-learning", "mlops", "data-storytelling", "feature-engineering"],
         ["Foundations", "Data Wrangling", "Machine Learning", "Advanced AI", "Applied Projects", "Career Launch"],
         [["python", "sql", "statistics", "probability"], ["pandas", "numpy", "data-visualization", "excel"],
          ["machine-learning", "scikit-learn", "model-evaluation", "feature-engineering"],
          ["deep-learning", "nlp", "mlops", "data-ethics"], ["git", "docker", "cloud-aws", "data-storytelling"],
          ["interview-preparation", "presentation", "communication"]],
         "15-2051.00", "http://data.europa.eu/esco/occupation/6a92a0b1-data-scientist", "High demand across tech, finance and healthcare",
         "data science,analytics,machine learning,statistics"),
    role("machine-learning-engineer", "Machine Learning Engineer", "Data & AI",
         "Build, deploy and monitor machine learning systems at production scale.",
         ["python", "machine-learning", "deep-learning", "scikit-learn", "docker", "mlops", "rest-apis"],
         ["python", "machine-learning", "scikit-learn", "deep-learning"],
         ["mlops", "kubernetes", "system-design", "transformers"],
         ["Programming & Math", "Core ML", "Deep Learning", "ML Platform", "Applied Projects", "Career Launch"],
         [["python", "linear-algebra", "statistics", "sql"], ["machine-learning", "scikit-learn", "model-evaluation", "feature-engineering"],
          ["deep-learning", "pytorch", "tensorflow", "nlp", "computer-vision"],
          ["mlops", "docker", "kubernetes", "cloud-aws", "cicd"], ["rest-apis", "fastapi", "git", "system-design"],
          ["interview-preparation", "communication", "presentation"]],
         "15-2051.01", "http://data.europa.eu/esco/occupation/ml-engineer", "Very high demand; strong salary growth",
         "ml engineer,deep learning,mlops,python"),
    role("data-analyst", "Data Analyst", "Data & AI",
         "Answer business questions with clean data, clear dashboards and honest analysis.",
         ["excel", "sql", "statistics", "pandas", "data-visualization", "dashboarding", "communication"],
         ["excel", "sql", "statistics", "data-visualization"],
         ["python", "power-bi", "tableau", "ab-testing", "data-storytelling"],
         ["Analytics Foundations", "Python for Analysis", "Business Intelligence", "Experimentation", "Projects", "Career Launch"],
         [["excel", "sql", "statistics", "problem-solving"], ["python", "pandas", "numpy", "data-visualization"],
          ["business-analysis", "power-bi", "tableau", "dashboarding"], ["ab-testing", "data-storytelling", "data-ethics", "analytics"],
          ["git", "google-analytics"], ["interview-preparation", "presentation", "communication"]],
         "15-2051.00", "http://data.europa.eu/esco/occupation/data-analyst", "High demand in every industry",
         "data analyst,excel,sql,tableau,power bi"),
    role("full-stack-developer", "Full Stack Developer", "Software",
         "Ship complete web products: interfaces, APIs, databases and deployment.",
         ["html-css", "javascript", "react", "nodejs", "postgresql", "rest-apis", "git", "docker"],
         ["html-css", "javascript", "react", "nodejs", "postgresql", "rest-apis"],
         ["typescript", "system-design", "testing", "kubernetes", "cloud-aws"],
         ["Web Foundations", "Frontend & Backend", "Professional Engineering", "Scale & Deploy", "Capstone Projects", "Career Launch"],
         [["html-css", "javascript", "git", "problem-solving"], ["react", "nodejs", "express", "postgresql", "rest-apis"],
          ["typescript", "mongodb", "redis", "testing", "system-design"], ["docker", "cicd", "cloud-aws", "security-fundamentals"],
          ["tailwind", "nextjs", "graphql", "frontend-performance"], ["interview-preparation", "communication", "teamwork"]],
         "15-1252.00", "http://data.europa.eu/esco/occupation/full-stack-developer", "Very high demand worldwide",
         "full stack,web developer,react,node,postgresql"),
    role("frontend-developer", "Frontend Developer", "Software",
         "Create accessible, fast and delightful user interfaces for the web.",
         ["html-css", "javascript", "react", "typescript", "tailwind", "accessibility", "git"],
         ["html-css", "javascript", "react", "typescript", "responsive-design"],
         ["nextjs", "frontend-performance", "design-systems", "web-security", "testing"],
         ["Web Fundamentals", "React & Styling", "Quality & Accessibility", "Advanced Frontend", "Portfolio Projects", "Career Launch"],
         [["html-css", "javascript", "responsive-design", "git"], ["react", "tailwind", "typescript", "state-management"],
          ["accessibility", "testing", "design-systems", "ui-design"], ["nextjs", "frontend-performance", "web-security", "rest-apis"],
          ["figma", "motion-design"], ["interview-preparation", "communication", "presentation"]],
         "15-1254.00", "http://data.europa.eu/esco/occupation/frontend-developer", "High demand, portfolio-driven hiring",
         "frontend,react,typescript,css,ui"),
    role("backend-developer", "Backend Developer", "Software",
         "Design reliable APIs, data models and services that power applications.",
         ["python", "sql", "postgresql", "rest-apis", "fastapi", "docker", "testing", "git"],
         ["python", "postgresql", "rest-apis", "fastapi", "testing"],
         ["system-design", "redis", "kubernetes", "cloud-aws", "security-fundamentals"],
         ["Programming Foundations", "APIs & Databases", "Distributed Systems", "Cloud & Security", "Projects", "Career Launch"],
         [["python", "sql", "git", "linux"], ["fastapi", "postgresql", "rest-apis", "testing"],
          ["system-design", "redis", "mongodb", "docker"], ["kubernetes", "cloud-aws", "security-fundamentals", "cicd"],
          ["message-queues", "monitoring", "graphql"], ["interview-preparation", "communication", "teamwork"]],
         "15-1252.00", "http://data.europa.eu/esco/occupation/backend-developer", "High demand across product companies",
         "backend,api,python,fastapi,postgresql"),
    role("cloud-devops-engineer", "Cloud / DevOps Engineer", "Cloud & Systems",
         "Automate infrastructure and keep systems reliable, observable and secure.",
         ["linux", "networking", "docker", "kubernetes", "cicd", "cloud-aws", "terraform", "python"],
         ["linux", "networking", "docker", "cicd", "cloud-aws"],
         ["kubernetes", "terraform", "monitoring", "security-fundamentals", "cost-optimization"],
         ["Systems Foundations", "Containers & Delivery", "Platform Engineering", "Reliability & Security", "Projects", "Career Launch"],
         [["linux", "networking", "git", "python"], ["docker", "cicd", "cloud-aws", "bash"],
          ["kubernetes", "terraform", "monitoring", "ansible"], ["security-fundamentals", "incident-response", "system-design", "cost-optimization"],
          ["cloud-security", "monitoring"], ["interview-preparation", "communication", "problem-solving"]],
         "15-1244.00", "http://data.europa.eu/esco/occupation/devops-engineer", "Strong demand for cloud-native skills",
         "devops,cloud,aws,kubernetes,terraform"),
    role("cybersecurity-analyst", "Cybersecurity Analyst", "Security",
         "Protect systems and data by detecting, investigating and responding to threats.",
         ["networking", "linux", "security-fundamentals", "siem", "incident-response", "ethical-hacking"],
         ["networking", "linux", "security-fundamentals", "siem", "incident-response"],
         ["ethical-hacking", "cryptography", "cloud-security", "threat-modeling", "grc"],
         ["Security Foundations", "Defensive Operations", "Offensive & Cloud Security", "Governance & Architecture", "Labs", "Career Launch"],
         [["networking", "linux", "security-fundamentals", "python"], ["cryptography", "threat-modeling", "ethical-hacking", "web-security"],
          ["siem", "incident-response", "digital-forensics", "cloud-security"], ["grc", "security-architecture", "threat-intelligence", "safety-standards"],
          ["networking", "monitoring"], ["interview-preparation", "communication", "professional-ethics"]],
         "15-1212.00", "http://data.europa.eu/esco/occupation/cybersecurity-analyst", "Very high demand; persistent skills gap",
         "cybersecurity,soc,security analyst,siem,pentest"),
    role("ui-ux-designer", "UI/UX Designer", "Design",
         "Research user needs and design usable, beautiful digital products.",
         ["ux-research", "ui-design", "figma", "wireframing", "prototyping", "usability-testing", "communication"],
         ["ux-research", "ui-design", "figma", "wireframing", "prototyping"],
         ["design-systems", "interaction-design", "usability-testing", "information-architecture", "design-portfolio"],
         ["Design Foundations", "Visual & Interaction Design", "Research & Validation", "Design Systems", "Portfolio Projects", "Career Launch"],
         [["ux-research", "wireframing", "figma", "communication"], ["ui-design", "prototyping", "design-systems", "accessibility"],
          ["interaction-design", "usability-testing", "information-architecture", "html-css"], ["product-strategy", "design-portfolio", "branding", "motion-design"],
          ["canva", "figma"], ["interview-preparation", "presentation", "teamwork"]],
         "27-1024.00", "http://data.europa.eu/esco/occupation/ui-ux-designer", "High demand; portfolio is decisive",
         "ui ux,product design,figma,user research"),
    role("digital-marketing-specialist", "Digital Marketing Specialist", "Business",
         "Plan, run and measure campaigns that grow audiences and revenue.",
         ["digital-marketing", "seo", "content-marketing", "google-analytics", "social-media-marketing", "email-marketing"],
         ["digital-marketing", "seo", "content-marketing", "google-analytics"],
         ["paid-advertising", "conversion-optimization", "marketing-automation", "copywriting", "customer-segmentation"],
         ["Marketing Foundations", "Channels & Content", "Analytics & CRO", "Growth Systems", "Campaign Projects", "Career Launch"],
         [["digital-marketing", "content-marketing", "seo", "communication"], ["social-media-marketing", "email-marketing", "google-analytics", "branding"],
          ["paid-advertising", "conversion-optimization", "marketing-automation", "copywriting"], ["analytics", "ab-testing", "customer-segmentation", "data-storytelling"],
          ["canva", "semrush-academy"], ["interview-preparation", "presentation", "leadership"]],
         "13-1161.00", "http://data.europa.eu/esco/occupation/digital-marketing-specialist", "High demand in agencies and startups",
         "digital marketing,seo,social media,analytics"),
    role("business-analyst", "Business Analyst", "Business",
         "Translate business problems into clear requirements and measurable solutions.",
         ["business-analysis", "requirements-gathering", "process-modeling", "sql", "excel", "agile-scrum", "communication"],
         ["business-analysis", "requirements-gathering", "process-modeling", "excel"],
         ["sql", "dashboarding", "stakeholder-management", "jira", "data-storytelling"],
         ["Business Foundations", "Analysis & Requirements", "Data & Delivery", "Stakeholder Leadership", "Projects", "Career Launch"],
         [["business-analysis", "excel", "communication", "problem-solving"], ["requirements-gathering", "process-modeling", "sql", "data-visualization"],
          ["agile-scrum", "jira", "stakeholder-management", "dashboarding"], ["product-strategy", "ab-testing", "data-storytelling", "project-management"],
          ["finance-fundamentals", "google-analytics"], ["interview-preparation", "presentation", "leadership"]],
         "13-1111.00", "http://data.europa.eu/esco/occupation/business-analyst", "Steady demand across consulting and product teams",
         "business analyst,requirements,process,sql,agile"),
    role("product-manager", "Product Manager", "Business",
         "Decide what to build, why it matters and how success will be measured.",
         ["product-strategy", "roadmapping", "user-stories", "agile-scrum", "analytics", "stakeholder-management", "communication"],
         ["product-strategy", "roadmapping", "user-stories", "agile-scrum"],
         ["analytics", "ab-testing", "stakeholder-management", "leadership", "go-to-market", "pricing-strategy"],
         ["Product Foundations", "Discovery & Delivery", "Data-Informed Product", "Leadership & Growth", "Projects", "Career Launch"],
         [["product-strategy", "ux-research", "communication", "problem-solving"], ["roadmapping", "user-stories", "agile-scrum", "analytics"],
          ["ab-testing", "sql", "stakeholder-management", "jira"], ["leadership", "data-storytelling", "go-to-market", "pricing-strategy"],
          ["finance-fundamentals", "project-management"], ["interview-preparation", "presentation", "critical-thinking"]],
         "11-2021.00", "http://data.europa.eu/esco/occupation/product-manager", "Competitive but high impact",
         "product manager,roadmap,agile,strategy"),
    role("mechanical-design-engineer", "Mechanical Design Engineer", "Engineering",
         "Design, analyze and manufacture mechanical components and systems.",
         ["engineering-mechanics", "autocad", "solidworks", "materials-science", "thermodynamics", "fea", "gdt"],
         ["engineering-mechanics", "autocad", "solidworks", "materials-science"],
         ["thermodynamics", "fea", "machine-design", "manufacturing-processes", "gdt", "product-design"],
         ["Engineering Foundations", "CAD & Materials", "Analysis & Design", "Manufacturing & Product", "Projects", "Career Launch"],
         [["engineering-mechanics", "autocad", "materials-science", "problem-solving"], ["solidworks", "thermodynamics", "manufacturing-processes", "matlab"],
          ["fea", "machine-design", "fluid-mechanics", "gdt"], ["product-design", "cad-simulation", "project-management", "safety-standards"],
          ["matlab", "solidworks"], ["interview-preparation", "communication", "presentation"]],
         "17-2141.00", "http://data.europa.eu/esco/occupation/mechanical-engineer", "Demand in manufacturing, automotive and energy",
         "mechanical engineering,cad,solidworks,design,fea"),
    role("civil-engineer", "Civil Engineer", "Engineering",
         "Plan, analyze and deliver safe infrastructure and built environments.",
         ["engineering-mechanics", "surveying", "autocad", "structural-analysis", "concrete-design", "construction-management"],
         ["engineering-mechanics", "surveying", "autocad", "structural-analysis"],
         ["concrete-design", "steel-design", "soil-mechanics", "construction-management", "earthquake-engineering", "sustainable-design"],
         ["Engineering Foundations", "Structures & Materials", "Design & Geotechnics", "Delivery & Resilience", "Projects", "Career Launch"],
         [["engineering-mechanics", "surveying", "autocad", "materials-science"], ["structural-analysis", "concrete-design", "soil-mechanics", "fluid-mechanics"],
          ["steel-design", "transportation-engineering", "construction-management", "matlab"], ["earthquake-engineering", "sustainable-design", "project-management", "safety-standards"],
          ["autocad", "matlab"], ["interview-preparation", "communication", "presentation"]],
         "17-2051.00", "http://data.europa.eu/esco/occupation/civil-engineer", "Steady infrastructure demand",
         "civil engineering,structures,construction,surveying"),
    role("electrical-engineer", "Electrical Engineer", "Engineering",
         "Design and analyze electrical systems, electronics and energy infrastructure.",
         ["circuit-analysis", "electronics", "power-systems", "control-systems", "matlab", "embedded-systems"],
         ["circuit-analysis", "electronics", "power-systems"],
         ["control-systems", "embedded-systems", "plc", "renewable-energy", "electric-machines", "smart-grids"],
         ["Electrical Foundations", "Electronics & Power", "Control & Embedded", "Energy Systems", "Projects", "Career Launch"],
         [["circuit-analysis", "engineering-mechanics", "matlab", "problem-solving"], ["electronics", "power-systems", "control-systems", "embedded-systems"],
          ["plc", "signal-processing", "renewable-energy", "electric-machines"], ["smart-grids", "iot", "project-management", "safety-standards"],
          ["matlab", "circuit-analysis"], ["interview-preparation", "communication", "presentation"]],
         "17-2071.00", "http://data.europa.eu/esco/occupation/electrical-engineer", "Growing with energy transition and electronics",
         "electrical engineering,circuits,power,electronics"),
    role("mobile-developer", "Mobile App Developer", "Software",
         "Build polished cross-platform mobile apps and ship them to app stores.",
         ["javascript", "react", "typescript", "firebase", "rest-apis", "ui-design", "testing"],
         ["javascript", "react", "typescript", "rest-apis"],
         ["firebase", "ui-design", "testing", "web-security", "state-management"],
         ["Mobile Foundations", "App Development", "Data & Services", "Quality & Launch", "App Projects", "Career Launch"],
         [["javascript", "typescript", "html-css", "git"], ["react", "state-management", "ui-design", "figma"],
          ["rest-apis", "firebase", "postgresql", "testing"], ["web-security", "frontend-performance", "accessibility", "cicd"],
          ["tailwind", "docker"], ["interview-preparation", "communication", "presentation"]],
         "15-1252.00", "http://data.europa.eu/esco/occupation/mobile-developer", "Healthy demand for cross-platform skills",
         "mobile app,react native,flutter,ios,android"),
    role("research-scientist", "Research Scientist / Academic", "Research",
         "Investigate problems rigorously and communicate new knowledge.",
         ["research-methods", "statistics", "python", "academic-writing", "critical-thinking", "data-ethics"],
         ["research-methods", "statistics", "critical-thinking", "academic-writing"],
         ["python", "machine-learning", "data-visualization", "presentation", "professional-ethics"],
         ["Research Foundations", "Methods & Statistics", "Domain Depth", "Publication & Communication", "Research Projects", "Career Launch"],
         [["research-methods", "critical-thinking", "statistics", "communication"], ["probability", "python", "data-visualization", "academic-writing"],
          ["machine-learning", "data-ethics", "professional-ethics", "linear-algebra"], ["academic-writing", "presentation", "data-storytelling", "project-management"],
          ["research-methods", "statistics"], ["interview-preparation", "presentation", "academic-writing"]],
         "19-1099.00", "http://data.europa.eu/esco/occupation/researcher", "Depends on field; strong for advanced degrees",
         "research,academia,scientist,statistics,publication"),
]

# ---------------------------------------------------------------------------
# LEARNING RESOURCES
# ---------------------------------------------------------------------------
RESOURCES = [
    ("res-python-docs", "Python Official Tutorial", "Documentation", "https://docs.python.org/3/tutorial/", "python", "Python Software Foundation", "Free", "The authoritative starting point for Python."),
    ("res-mdn-js", "MDN JavaScript Guide", "Documentation", "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide", "javascript|typescript", "Mozilla", "Free", "Comprehensive JavaScript language guide."),
    ("res-fastapi", "FastAPI Documentation", "Documentation", "https://fastapi.tiangolo.com/", "fastapi|rest-apis|python", "FastAPI", "Free", "Tutorial and reference for the backend framework used here."),
    ("res-react", "React Documentation", "Documentation", "https://react.dev/learn", "react|state-management", "React Team", "Free", "Official modern React learning path."),
    ("res-postgres", "PostgreSQL Tutorial", "Tutorial", "https://www.postgresql.org/docs/current/tutorial.html", "postgresql|sql", "PostgreSQL", "Free", "Official relational database tutorial."),
    ("res-sklearn", "scikit-learn User Guide", "Documentation", "https://scikit-learn.org/stable/user_guide.html", "scikit-learn|machine-learning", "scikit-learn", "Free", "Algorithms, preprocessing and model evaluation."),
    ("res-pandas", "Pandas 10 Minutes to Pandas", "Tutorial", "https://pandas.pydata.org/docs/user_guide/10min.html", "pandas|numpy", "Pandas", "Free", "Fast introduction to DataFrames."),
    ("res-owasp", "OWASP Top 10", "Reference", "https://owasp.org/www-project-top-ten/", "web-security|security-fundamentals", "OWASP", "Free", "The most critical web application security risks."),
    ("res-kubernetes", "Kubernetes Basics", "Tutorial", "https://kubernetes.io/docs/tutorials/kubernetes-basics/", "kubernetes|docker", "Kubernetes", "Free", "Interactive introduction to Kubernetes."),
    ("res-docker", "Docker Get Started", "Tutorial", "https://docs.docker.com/get-started/", "docker", "Docker", "Free", "Official container getting-started guide."),
    ("res-figma", "Figma Learn Help Center", "Documentation", "https://help.figma.com/hc/en-us", "figma|ui-design|prototyping", "Figma", "Free", "Official Figma help and tutorials."),
    ("res-ga4", "Google Analytics Academy", "Course", "https://analytics.google.com/analytics/academy/", "google-analytics|analytics|digital-marketing", "Google", "Free", "Free GA4 training and certifications."),
    ("res-onet", "O*NET OnLine", "Career Data", "https://www.onetonline.org/", "career|research", "U.S. Department of Labor", "Free", "Occupational information used to model career requirements."),
    ("res-esco", "ESCO Occupations", "Career Data", "https://esco.ec.europa.eu/en/classification/occupation_main", "career|research", "European Commission", "Free", "European skills, competences and occupations taxonomy."),
    ("res-mit-ocw", "MIT OpenCourseWare", "Open Courseware", "https://ocw.mit.edu/", "engineering|computer-science", "MIT", "Free", "University-level course materials across engineering and science."),
    ("res-nptel", "NPTEL", "Open Courseware", "https://nptel.ac.in/", "engineering|python|machine-learning", "IITs / IISc", "Free", "Indian national programme of online engineering courses."),
    ("res-swayam", "SWAYAM", "Open Courseware", "https://swayam.gov.in/", "engineering|management|communication", "Government of India", "Free", "National online education platform."),
    ("res-interview", "Tech Interview Handbook", "Guide", "https://www.techinterviewhandbook.org/", "interview-preparation|algorithms|data-structures", "Yangshun Tay", "Free", "Structured interview preparation guide."),
    ("res-roadmap", "roadmap.sh", "Guide", "https://roadmap.sh/", "career|system-design|frontend|backend", "roadmap.sh", "Free", "Community roadmaps for developer careers."),
    ("res-khan", "Khan Academy", "Course", "https://www.khanacademy.org/", "statistics|probability|linear-algebra|finance-fundamentals", "Khan Academy", "Free", "Free foundational math and finance lessons."),
]
resource_rows = [
    {"resource_id": r[0], "title": r[1], "resource_type": r[2], "url": r[3],
     "skills": r[4], "platform": r[5], "price_type": r[6], "description": r[7]}
    for r in RESOURCES
]

# ---------------------------------------------------------------------------
# SAMPLE STUDENT PROFILES (export/demo data)
# ---------------------------------------------------------------------------
STUDENTS = [
    {
        "student_id": "demo-student", "email": "demo@smartlearn.ai", "full_name": "Aarav Sharma",
        "age": 21, "country": "India", "preferred_language": "English",
        "college_name": "National Institute of Technology", "degree": "B.Tech",
        "department": "Computer Science", "current_year": "3", "current_semester": "5",
        "cgpa": "8.4", "academic_subjects": "Data Structures, DBMS, Operating Systems, Statistics",
        "previous_qualifications": "Higher Secondary (Science, 92%)",
        "programming_languages": "Python, JavaScript, SQL",
        "frameworks": "React",
        "tools": "Git, VS Code, Jupyter",
        "databases": "PostgreSQL, SQLite",
        "technical_skills": "HTML/CSS, Pandas, NumPy",
        "soft_skills": "Communication, Teamwork",
        "desired_role": "Data Scientist", "career_role_id": "data-scientist",
        "interested_industries": "Technology, Fintech, Healthcare",
        "preferred_positions": "Data Scientist, ML Analyst",
        "short_term_goal": "Land a data science internship within 8 months",
        "long_term_goal": "Lead an applied ML team",
        "previous_projects": "Exploratory analysis of IPL data; personal portfolio site",
        "internships": "None", "certifications": "freeCodeCamp Responsive Web Design",
        "work_experience": "None", "portfolio_url": "https://github.com/example",
        "proficiency_level": "Intermediate", "budget_pref": "Both",
        "preferred_platforms": "Coursera, Kaggle, freeCodeCamp",
        "learning_style": "Practical", "course_language": "English",
        "hours_per_day": 3, "days_per_week": 5, "parallel_learning": "false",
        "target_completion_date": "2027-06-30",
    }
]

# ---------------------------------------------------------------------------
# WRITE AND CLEAN
# ---------------------------------------------------------------------------
def write_csv(name, rows, fieldnames):
    path = DATASETS / name
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for row in rows:
            w.writerow({k: row.get(k, "") for k in fieldnames})
    return path


def main():
    # skills
    write_csv("skills.csv", skill_rows, ["skill_id", "skill_name", "category", "level", "description", "aliases"])
    write_csv("skill_prerequisites.csv", skill_prereq_rows, ["skill_id", "prerequisite_skill_id", "strength"])
    write_csv("courses.csv", COURSES, [
        "course_id", "title", "description", "skills", "category", "difficulty", "platform", "url",
        "link_type", "duration_hours", "duration_is_estimate", "price_type", "price_usd", "price_note",
        "language", "prerequisites", "certificate", "rating", "rating_count", "verified",
        "verification_note", "learning_type", "last_checked",
    ])
    write_csv("career_roles.csv", CAREERS, [
        "role_id", "title", "category", "description", "required_skills", "core_skills", "advanced_skills",
        "phase_titles", "phase1_skills", "phase2_skills", "phase3_skills", "phase4_skills",
        "phase5_skills", "phase6_skills", "onet_code", "esco_uri", "demand_outlook", "keywords",
    ])
    write_csv("projects.csv", project_rows, [
        "project_id", "title", "description", "career_role", "skills", "difficulty",
        "duration_hours", "project_type", "deliverables", "github_url", "reference_url",
    ])
    write_csv("learning_resources.csv", resource_rows, [
        "resource_id", "title", "resource_type", "url", "skills", "platform", "price_type", "description",
    ])

    student_fields = list(STUDENTS[0].keys())
    write_csv("student_profiles.csv", STUDENTS, student_fields)

    # Pandas cleaning / validation pass
    warnings = []
    courses = pd.read_csv(DATASETS / "courses.csv")
    courses = courses.drop_duplicates(subset=["course_id"])
    courses["platform"] = courses["platform"].str.strip()
    courses["difficulty"] = courses["difficulty"].str.lower().str.strip()
    courses["verified"] = courses["verified"].fillna(0).astype(int)
    courses["duration_hours"] = pd.to_numeric(courses["duration_hours"], errors="coerce")
    courses.to_csv(DATASETS / "courses.csv", index=False)

    skills = pd.read_csv(DATASETS / "skills.csv")
    known = set(skills["skill_id"])
    for _, row in courses.iterrows():
        for s in str(row["skills"]).split("|"):
            if s and s not in known:
                warnings.append(f"course {row['course_id']} references unknown skill {s}")
    for _, row in pd.read_csv(DATASETS / "skill_prerequisites.csv").iterrows():
        for s in (row["skill_id"], row["prerequisite_skill_id"]):
            if s not in known:
                warnings.append(f"prerequisite references unknown skill {s}")

    careers = pd.read_csv(DATASETS / "career_roles.csv")
    for _, row in careers.iterrows():
        for s in str(row["required_skills"]).split("|"):
            if s and s not in known:
                warnings.append(f"career {row['role_id']} references unknown skill {s}")

    print(f"Wrote {len(courses)} courses, {len(skills)} skills, {len(careers)} careers, "
          f"{len(project_rows)} projects, {len(resource_rows)} resources to {DATASETS}")
    if warnings:
        print("Dataset warnings:")
        for w in warnings:
            print(" -", w)
    else:
        print("Dataset validation passed: all skill references resolve.")


if __name__ == "__main__":
    main()
