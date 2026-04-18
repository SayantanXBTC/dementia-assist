import Navbar       from '@/components/landing/Navbar';
import HeroSection  from '@/components/landing/HeroSection';
import AboutSection from '@/components/landing/AboutSection';

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <AboutSection />
      </main>

      <footer className="py-8 text-center border-t border-black/5"
              style={{ background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(12px)' }}>
        <p className="font-dm-sans text-sm text-text-soft">
          © {new Date().getFullYear()} RecallPal. Built with care for families everywhere.
        </p>
      </footer>
    </>
  );
}
