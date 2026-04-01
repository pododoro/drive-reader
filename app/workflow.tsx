import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CircleHelp, FileText, Link2, Mic2, Square } from 'lucide-react-native';

const steps = [
  {
    number: '1',
    title: 'Open the app',
    body: 'Start on the main screen. Nothing is forced on you first.',
  },
  {
    number: '2',
    title: 'Put data in',
    body: 'Paste text, choose a file, use a file path, or enter a Naver blog URL.',
  },
  {
    number: '3',
    title: 'Confirm it',
    body: 'Check the preview, the file card, and the status line before reading.',
  },
  {
    number: '4',
    title: 'Read it',
    body: 'Tap Speak when the content looks correct.',
  },
];

const notes = [
  'Recent inputs are there only as shortcuts. They do not replace the normal flow.',
  'If something looks wrong, fix the input first and re-check the preview.',
  'The help page is for learning the flow, not for daily use.',
];

export default function WorkflowScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.iconWrap}>
              <CircleHelp size={22} color="#0F172A" />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.kicker}>Drive Reader</Text>
              <Text style={styles.title}>How to use the app</Text>
              <Text style={styles.subtitle}>
                This page explains the intended flow so the main screen can stay focused.
              </Text>
            </View>
          </View>
          <Link href="/" dismissTo asChild>
            <Pressable style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}>
              <ArrowLeft size={16} color="#FFFFFF" />
              <Text style={styles.backLabel}>Back to app</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Mic2 size={18} color="#0F172A" />
            <Text style={styles.sectionTitle}>Workflow</Text>
          </View>
          <View style={styles.stepList}>
            {steps.map((step) => (
              <View key={step.number} style={styles.stepCard}>
                <Text style={styles.stepNumber}>{step.number}</Text>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FileText size={18} color="#0F172A" />
            <Text style={styles.sectionTitle}>Notes</Text>
          </View>
          <View style={styles.noteList}>
            {notes.map((note) => (
              <View key={note} style={styles.noteCard}>
                <Square size={12} color="#64748B" />
                <Text style={styles.noteBody}>{note}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Link2 size={18} color="#0F172A" />
            <Text style={styles.sectionTitle}>Remember</Text>
          </View>
          <View style={styles.rememberCard}>
            <Text style={styles.rememberText}>
              Use the main screen for daily input and reading. Open this page only when you need a
              reminder of the intended order.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 18,
    paddingBottom: 32,
    gap: 14,
  },
  hero: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 14,
  },
  heroTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#64748B',
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },
  backButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  backPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  backLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  section: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  stepList: {
    gap: 10,
  },
  stepCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    gap: 6,
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  stepBody: {
    fontSize: 13,
    lineHeight: 18,
    color: '#475569',
  },
  noteList: {
    gap: 10,
  },
  noteCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  noteBody: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#334155',
  },
  rememberCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  rememberText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#334155',
  },
});
