const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = document.querySelector("[data-nav-links]");

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    navLinks.classList.toggle("open");
  });
}

const reveals = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14 }
  );

  reveals.forEach((element) => observer.observe(element));
} else {
  reveals.forEach((element) => element.classList.add("is-visible"));
}

const magneticButtons = document.querySelectorAll(".magnetic");

magneticButtons.forEach((button) => {
  button.addEventListener("mousemove", (event) => {
    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    button.style.transform = `translate(${x * 0.08}px, ${y * 0.08}px)`;
  });

  button.addEventListener("mouseleave", () => {
    button.style.transform = "";
  });
});

const parallaxRoot = document.querySelector("[data-parallax-root]");
const dashboardFrame = document.querySelector(".dashboard-frame");

if (parallaxRoot && dashboardFrame && window.matchMedia("(min-width: 861px)").matches) {
  parallaxRoot.addEventListener("mousemove", (event) => {
    const rect = parallaxRoot.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    dashboardFrame.style.transform =
      `perspective(1200px) rotateY(${x * 12}deg) rotateX(${y * -10}deg) translateY(${y * 10}px)`;
  });

  parallaxRoot.addEventListener("mouseleave", () => {
    dashboardFrame.style.transform = "perspective(1200px) rotateY(-10deg) rotateX(4deg)";
  });
}
