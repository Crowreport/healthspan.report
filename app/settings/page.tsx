"use client";

import { useState, useEffect, useMemo } from "react";
import { Header, Footer } from "@/components/layout";
import { ThemeToggle, Button } from "@/components/ui";
import { useUserStore } from "@/store/useUserStore";
import { createClient } from "@/utils/supabase/client";
import styles from "./page.module.css";

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState("Roboto (Default)");
  const [language, setLanguage] = useState("English");

  // Account Information State
  const profile = useUserStore((s) => s.profile);
  const setProfile = useUserStore((s) => (s as any).setProfile);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const savedMotion = localStorage.getItem("healthspan-reduce-motion") === "true";
    const savedFontSize = localStorage.getItem("healthspan-font-size") || "16";
    const savedFontFamily = localStorage.getItem("healthspan-font-family") || "Roboto (Default)";
    const savedLanguage = localStorage.getItem("healthspan-language") || "English";

    setIsReducedMotion(savedMotion);
    setFontSize(parseInt(savedFontSize));
    setFontFamily(savedFontFamily);
    setLanguage(savedLanguage);

    // Apply initial states to document
    document.documentElement.setAttribute("data-reduce-motion", savedMotion.toString());
    document.documentElement.style.fontSize = `${savedFontSize}px`;
  }, []);

  
  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || "");
      setLastName(profile.lastName || "");
      setUsername(profile.username || "");
    }
  }, [profile]);

  const handleUpdateProfile = async () => {
    if (!profile?.id) return;
    
    setIsSaving(true);

    
    if (newPassword) {
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (authError) {
        alert(`Password update failed: ${authError.message}`);
        setIsSaving(false);
        return;
      }
    }

    
    const { error } = await supabase
      .from("users")
      .update({
        first_name: firstName,
        last_name: lastName,
        username: username,
      })
      .eq("id", profile.id);

    if (error) {
      alert(`Error updating profile: ${error.message}`);
    } else {
      // Update the global store so the Header and other components reflect changes
      if (setProfile && profile) {
        setProfile({ ...profile, firstName, lastName, username });
      }
      setNewPassword("");
      
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }
    setIsSaving(false);
  };

  return (
    <div className={styles.page}>
      <Header />
      
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>Settings</h1>
          
          <div className={styles.subheadingGroup}>
            <h2 className={styles.subheading}>Preferences</h2>
            
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Appearance</h3>
              <p className={styles.sectionDescription}>
                Customize how Healthspan looks on your device.
              </p>
              <ThemeToggle />
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Font</h3>
              <p className={styles.sectionDescription}>
                Adjust the font family and size for better readability.
              </p>
              <div className={styles.controlRow}>
                <div className={styles.control}>
                  <label className={styles.label}>Font Size ({fontSize}px)</label>
                  <div className={styles.sliderContainer}>
                    <input 
                      type="range" 
                      className={styles.slider} 
                      min="12" 
                      max="24" 
                      value={fontSize}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFontSize(parseInt(val));
                        document.documentElement.style.fontSize = `${val}px`;
                        localStorage.setItem("healthspan-font-size", val);
                      }}
                    />
                    <div className={styles.defaultMarker} title="Default (16px)" />
                  </div>
                </div>
                <div className={styles.control}>
                  <label className={styles.label}>Font Family</label>
                  <select 
                    className={styles.select}
                    value={fontFamily}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFontFamily(val);
                      localStorage.setItem("healthspan-font-family", val);
                    }}
                  >
                    <option>Roboto (Default)</option>
                    <option>Open Sans</option>
                    <option>Inter</option>
                  </select>
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Reduced Animations</h3>
              <p className={styles.sectionDescription}>
                Minimize motion effects throughout the application.
              </p>
            <Button 
              variant={isReducedMotion ? "primary" : "outline"} 
              size="sm"
              onClick={() => {
                const nextValue = !isReducedMotion;
                setIsReducedMotion(nextValue);
                document.documentElement.setAttribute("data-reduce-motion", nextValue.toString());
                localStorage.setItem("healthspan-reduce-motion", nextValue.toString());
              }}
            >
              {isReducedMotion ? "Reduced Motion Enabled" : "Enable Reduced Motion"}
            </Button>
            </section>
          </div>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Language</h2>
            <p className={styles.sectionDescription}>
              Select your preferred language for the interface.
            </p>
            <select 
              className={styles.select}
              value={language}
              onChange={(e) => {
                const val = e.target.value;
                setLanguage(val);
                localStorage.setItem("healthspan-language", val);
              }}
            >
              <option>English</option>
              <option>Spanish</option>
              <option>French</option>
            </select>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>System</h2>
            <p className={styles.sectionDescription}>
              Manage application data and clear temporary files.
            </p>
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
            >Clear Cache</Button>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Account Information</h2>
            <p className={styles.sectionDescription}>
              Manage your profile details and contact information.
            </p>
            
            {!profile ? (
              <div className={styles.placeholderText}>Please log in to manage your account settings.</div>
            ) : (
              <div className={styles.accountForm}>
                <div className={styles.controlRow}>
                  <div className={styles.control}>
                    <label className={styles.label}>First Name</label>
                    <input 
                      className={styles.input} 
                      value={firstName} 
                      onChange={(e) => setFirstName(e.target.value)} 
                    />
                  </div>
                  <div className={styles.control}>
                    <label className={styles.label}>Last Name</label>
                    <input 
                      className={styles.input} 
                      value={lastName} 
                      onChange={(e) => setLastName(e.target.value)} 
                    />
                  </div>
                </div>
                <div className={styles.control} style={{ marginTop: 'var(--space-md)' }}>
                  <label className={styles.label}>Username</label>
                  <input 
                    className={styles.input} 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                  />
                </div>
                <div className={styles.control} style={{ marginTop: 'var(--space-md)' }}>
                  <label className={styles.label}>New Password (leave blank to keep current)</label>
                  <input 
                    type="password"
                    className={styles.input} 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    placeholder="••••••••"
                  />
                </div>
                <div className={styles.formActions}>
                  <Button 
                    variant={isSaved ? "secondary" : "primary"} 
                    onClick={handleUpdateProfile} 
                    disabled={isSaving || isSaved}
                  >
                    {isSaving ? "Saving..." : 
                     isSaved ? "Saved ✓" : 
                     "Save Changes"}
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}