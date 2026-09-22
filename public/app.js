/**
 * Candidate Matchmaker Client Application
 * Minimal, clean, robust UI handling with Gmail API outreach integration.
 */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("match-form");
  const jobDescriptionInput = document.getElementById("job-description");
  const submitBtn = document.getElementById("submit-btn");
  const btnText = submitBtn.querySelector(".btn-text");
  const sampleBtn = document.getElementById("sample-btn");

  const resultsSection = document.getElementById("results-section");
  const resultsCount = document.getElementById("results-count");
  const candidatesList = document.getElementById("candidates-list");
  const errorMessage = document.getElementById("error-message");
  const errorText = errorMessage.querySelector(".error-text");

  // Email Modal Elements
  const emailModal = document.getElementById("email-modal");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const emailForm = document.getElementById("email-form");
  const emailTo = document.getElementById("email-to");
  const emailSubject = document.getElementById("email-subject");
  const emailBody = document.getElementById("email-body");
  const modalSendBtn = document.getElementById("modal-send-btn");
  const modalSendText = modalSendBtn.querySelector(".btn-text");

  // Toast
  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toast-text");

  // Set of candidates who have been sent outreach emails
  const sentEmails = new Set();
  let currentTargetCard = null;

  // Sample job description for quick testing
  const sampleJD = `Role: Senior AI/ML Full Stack Engineer
Location: San Francisco, CA (or Remote)
Experience: 5+ years

Key Responsibilities:
- Design and deploy scalable production machine learning pipelines and LLM applications.
- Fine-tune models (LoRA/QLoRA) and implement robust RAG workflows.
- Develop clean RESTful APIs using Python / FastAPI / Node.js and modern web frontends.
- Collaborate with product and engineering teams to translate research prototypes into reliable cloud services.

Requirements:
- Strong proficiency in Python, PyTorch, TensorFlow, or Hugging Face.
- Hands-on experience with cloud deployment, Docker, and MLOps.
- Strong full-stack web development skills (APIs, UI, databases).`;

  // Pre-fill sample JD
  sampleBtn.addEventListener("click", () => {
    jobDescriptionInput.value = sampleJD;
    jobDescriptionInput.focus();
  });

  // Handle matching request
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const jobDescription = jobDescriptionInput.value.trim();
    if (!jobDescription) {
      showError("Please enter a job description.");
      return;
    }

    setLoading(true);
    hideError();
    resultsSection.style.display = "none";
    candidatesList.innerHTML = "";

    try {
      const response = await fetch("/api/match-candidates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobDescription }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to find matching candidates.");
      }

      renderCandidates(data.candidates || []);
    } catch (err) {
      console.error("Match error:", err);
      showError(err.message || "An unexpected error occurred while communicating with the server.");
    } finally {
      setLoading(false);
    }
  });

  function setLoading(isLoading) {
    if (isLoading) {
      submitBtn.disabled = true;
      submitBtn.classList.add("loading");
      btnText.textContent = "Finding the best matches...";
    } else {
      submitBtn.disabled = false;
      submitBtn.classList.remove("loading");
      btnText.textContent = "Find Candidates";
    }
  }

  function showError(msg) {
    errorText.textContent = msg;
    errorMessage.style.display = "block";
  }

  function hideError() {
    errorMessage.style.display = "none";
    errorText.textContent = "";
  }

  function renderCandidates(candidates) {
    resultsSection.style.display = "block";

    if (!candidates || candidates.length === 0) {
      resultsCount.textContent = "0 matches";
      candidatesList.innerHTML = `
        <div class="no-candidates">
          No matching candidates found in the knowledge base for this job description.
        </div>
      `;
      return;
    }

    resultsCount.textContent = `${candidates.length} ${candidates.length === 1 ? "candidate" : "candidates"}`;

    candidatesList.innerHTML = candidates
      .map((candidate, idx) => {
        const name = escapeHtml(candidate.name || "Unknown Candidate");
        const email = candidate.email ? escapeHtml(candidate.email) : "";
        const score = candidate.match_score !== null && candidate.match_score !== undefined
          ? `<span class="candidate-score">Match score: ${candidate.match_score}</span>`
          : "";

        const emailHtml = email
          ? `<a href="mailto:${email}" class="candidate-email">${email}</a>`
          : `<span class="candidate-email" style="color: #94a3b8; font-style: italic;">Email not listed</span>`;

        const isSent = email && sentEmails.has(email.toLowerCase());
        const actionHtml = email
          ? isSent
            ? `<span class="email-sent-badge">&check; Email Sent</span>`
            : `<button type="button" class="email-btn" data-name="${name}" data-email="${email}" data-card-id="card-${idx}">Send Email</button>`
          : "";

        return `
          <div class="candidate-card" id="card-${idx}">
            <div class="candidate-info">
              <div class="candidate-name">${name}</div>
              ${emailHtml}
            </div>
            <div class="candidate-side">
              ${score}
              ${actionHtml}
            </div>
          </div>
        `;
      })
      .join("");

    // Attach click handlers to Send Email buttons
    candidatesList.querySelectorAll(".email-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.getAttribute("data-name");
        const email = btn.getAttribute("data-email");
        const cardId = btn.getAttribute("data-card-id");
        openEmailModal(name, email, cardId);
      });
    });

    // Scroll smoothly to results
    resultsSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // Open Email Modal
  async function openEmailModal(candidateName, candidateEmail, cardId) {
    currentTargetCard = document.getElementById(cardId);
    emailTo.value = candidateEmail;

    // Detect role from job description or default
    const jd = jobDescriptionInput.value;
    let role = "Senior AI/ML Engineer";
    const roleMatch = jd.match(/Role:\s*([^\n]+)/i) || jd.match(/Title:\s*([^\n]+)/i);
    if (roleMatch) {
      role = roleMatch[1].trim();
    }

    try {
      const res = await fetch(`/api/email-template?name=${encodeURIComponent(candidateName)}&role=${encodeURIComponent(role)}`);
      const template = await res.json();
      emailSubject.value = template.subject;
      emailBody.value = template.body;
    } catch (e) {
      emailSubject.value = `Interview Invitation: ${role} Opportunity`;
      emailBody.value = `Dear ${candidateName},\n\nWe reviewed your profile and would love to invite you for an interview.\n\nBest regards,\nTalent Acquisition`;
    }

    emailModal.style.display = "flex";
  }

  function closeEmailModal() {
    emailModal.style.display = "none";
    emailForm.reset();
    currentTargetCard = null;
  }

  modalCloseBtn.addEventListener("click", closeEmailModal);
  modalCancelBtn.addEventListener("click", closeEmailModal);

  // Close modal when clicking on the backdrop
  emailModal.addEventListener("click", (e) => {
    if (e.target === emailModal) {
      closeEmailModal();
    }
  });

  // Handle Email Form Submission
  emailForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const to = emailTo.value.trim();
    const subject = emailSubject.value.trim();
    const body = emailBody.value.trim();

    if (!to || !subject || !body) return;

    modalSendBtn.disabled = true;
    modalSendBtn.classList.add("loading");
    modalSendText.textContent = "Sending...";

    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to, subject, body }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to send email.");
      }

      // Mark as sent
      sentEmails.add(to.toLowerCase());

      // Update candidate card in UI
      if (currentTargetCard) {
        const sideDiv = currentTargetCard.querySelector(".candidate-side");
        const btn = currentTargetCard.querySelector(".email-btn");
        if (btn) {
          btn.remove();
        }
        const badge = document.createElement("span");
        badge.className = "email-sent-badge";
        badge.innerHTML = "&check; Email Sent";
        sideDiv.appendChild(badge);
      }

      closeEmailModal();
      showToast(`Outreach email sent successfully to ${to}!`);
    } catch (err) {
      alert(`Error sending email: ${err.message}`);
    } finally {
      modalSendBtn.disabled = false;
      modalSendBtn.classList.remove("loading");
      modalSendText.textContent = "Send Email";
    }
  });

  function showToast(msg) {
    toastText.textContent = msg;
    toast.style.display = "block";
    setTimeout(() => {
      toast.style.display = "none";
    }, 4500);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
