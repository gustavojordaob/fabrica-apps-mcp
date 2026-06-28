# CONTEXT.md — Agente React Native + Firebase + Expo
> Base de conhecimento consolidada para o Agente Dev de Telas (AGT-03) e Agente Firebase (AGT-04).
> Fontes: reactnative.dev/docs, docs.expo.dev/guides/using-firebase, docs.expo.dev/tutorial
> Versões de referência: React Native 0.85 · Expo SDK 54 · Firebase JS SDK ^12.0.0

---

## 0. POLÍTICA OBRIGATÓRIA — FIREBASE CLI E DEPLOY (TODOS OS AGENTES)

**Regra:** sempre que o repositório tiver `firebase.json` e o trabalho envolver **Firestore (regras ou índices), Storage (regras), Hosting ou Functions**, o agente **deve** publicar as mudanças no projeto Firebase — código local sem deploy **não** altera o ambiente em nuvem e o app continua com `permission-denied`, regras antigas ou índices faltando.

| Situação | Comando (na raiz do app, com `firebase login` feito) |
|----------|-----------------------------------------------------|
| Só regras do Firestore | `npx firebase-tools deploy --only firestore:rules --project <PROJECT_ID>` |
| Só índices Firestore | `npx firebase-tools deploy --only firestore:indexes --project <PROJECT_ID>` |
| Regras + índices | `npx firebase-tools deploy --only firestore --project <PROJECT_ID>` |
| Hosting / Functions | `npx firebase-tools deploy --only hosting` ou `--only functions` conforme `firebase.json` |

**Projeto ativo:** arquivo **`.firebaserc`** na raiz com `"default": "<PROJECT_ID>"`, **ou** passar sempre `--project <PROJECT_ID>`.

**Checklist antes de encerrar tarefa que mudou regras/schema:**
- [ ] `firestore.rules` (e `firestore.indexes.json` se criou consulta composta) está coerente com o código.
- [ ] Deploy executado com sucesso (saída `Deploy complete!`).
- [ ] Se não for possível rodar CLI neste ambiente, deixar no PR/comentário o comando exato e o `PROJECT_ID`.

**AGT-04 (Firebase):** tratar deploy como parte do mesmo entregável que `firestore.rules` / índices.

---

## 1. FUNDAMENTOS REACT NATIVE

### 1.1 O que é React Native
- Framework open-source da Meta para criar apps Android e iOS com React + JavaScript/TypeScript.
- Componentes React são mapeados para Views nativas reais (não WebView).
- Um único codebase roda em iOS, Android e Web (com Expo).

### 1.2 Core Components essenciais
| Componente RN     | Equivalente Android | Equivalente iOS  | Equivalente Web      | Uso                              |
|-------------------|---------------------|------------------|----------------------|----------------------------------|
| `<View>`          | ViewGroup           | UIView           | `<div>` não-scrollável| Container de layout (flexbox)    |
| `<Text>`          | TextView            | UITextView       | `<p>`                | Exibir texto; suporta onPress    |
| `<Image>`         | ImageView           | UIImageView      | `<img>`              | Imagens locais e remotas         |
| `<ScrollView>`    | ScrollView          | UIScrollView     | `<div>` com scroll   | Container com scroll livre       |
| `<FlatList>`      | RecyclerView        | UICollectionView | Virtual list         | Listas longas com boa performance|
| `<TextInput>`     | EditText            | UITextField      | `<input type="text">`| Campo de entrada de texto        |
| `<TouchableOpacity>` / `<Pressable>` | — | — | `<button>`        | Elementos clicáveis com feedback |
| `<ActivityIndicator>` | ProgressBar    | UIActivityIndicator | spinner CSS       | Loading spinner                  |
| `<Modal>`         | Dialog              | UIModalPresentationController | dialog | Sobreposição modal             |
| `<KeyboardAvoidingView>` | —          | —                | —                    | Evitar teclado virtual sobrepor conteúdo |

### 1.3 Estilo com StyleSheet
- Estilos são objetos JavaScript — não CSS. Propriedades em camelCase: `backgroundColor`, não `background-color`.
- Use sempre `StyleSheet.create({})` para melhor performance (valida em tempo de desenvolvimento).
- O prop `style` aceita objeto único ou array: `style={[styles.base, styles.extra]}` — o último tem precedência.

```typescript
import { StyleSheet, View, Text } from 'react-native';

export default function Card() {
  return (
    <View style={[styles.container, styles.shadow]}>
      <Text style={styles.title}>Olá</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    elevation: 3, // Android
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
});
```

### 1.4 Flexbox no React Native (diferenças do CSS web)
| Propriedade       | Padrão RN        | Padrão CSS Web  |
|-------------------|------------------|-----------------|
| `flexDirection`   | `'column'`       | `'row'`         |
| `alignContent`    | `'flex-start'`   | `'stretch'`     |
| `flexShrink`      | `0`              | `1`             |
| `flex`            | número único     | shorthand       |

Regras fundamentais:
- `flexDirection: 'column'` → filhos empilham verticalmente (padrão).
- `flexDirection: 'row'` → filhos ficam lado a lado.
- `justifyContent` → alinha no eixo principal.
- `alignItems` → alinha no eixo cruzado.
- `flex: 1` em filho → ocupa todo o espaço disponível.

```typescript
// Centralizar conteúdo na tela
container: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
},
// Linha com espaçamento
row: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
```

### 1.5 Safe Areas e Teclado
- **Sempre** usar `useSafeAreaInsets()` ou `<SafeAreaView>` para respeitar notch e home indicator.
- **Sempre** envolver formulários em `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>`.

```typescript
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function FormScreen() {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, paddingTop: insets.top }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* conteúdo do formulário */}
    </KeyboardAvoidingView>
  );
}
```

---

## 2. EXPO E EXPO GO

### 2.1 O que é Expo
- Framework open-source construído sobre React Native que simplifica setup, build e deploy.
- Fornece: file-based routing (Expo Router), SDK de módulos nativos, EAS Build e EAS Submit.
- **Expo Go**: app gratuito (iOS + Android) que roda seu projeto via QR Code sem precisar buildar — ideal para desenvolvimento.
- **Expo SDK 54** (versão atual, 2025): suporta nova arquitetura RN, `firebase@^12.0.0`.

### 2.2 Criar projeto
```bash
npx create-expo-app@latest MeuApp
cd MeuApp
npx expo start        # abre o dev server
# Escaneie o QR com Expo Go no celular
```

### 2.3 Expo Router — Navegação file-based
Inspirado no Next.js: estrutura de arquivos define as rotas.

```
app/
  _layout.tsx          ← Layout raiz (Stack, Tabs, Drawer)
  index.tsx            ← Rota "/" (tela inicial)
  (tabs)/
    _layout.tsx        ← Layout com Tabs
    home.tsx           ← Aba Home
    profile.tsx        ← Aba Perfil
  product/
    [id].tsx           ← Rota dinâmica /product/123
```

```typescript
// app/_layout.tsx — Stack Navigator
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Início' }} />
      <Stack.Screen name="product/[id]" options={{ title: 'Produto' }} />
    </Stack>
  );
}

// Navegar entre telas
import { router } from 'expo-router';
router.push('/product/123');
router.back();

// Ler parâmetros
import { useLocalSearchParams } from 'expo-router';
const { id } = useLocalSearchParams();
```

### 2.4 Expo Router — Tabs
```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
```

### 2.5 Instalação dependências essenciais
```bash
npx expo install expo-router react-native-safe-area-context react-native-screens
npx expo install expo-status-bar expo-linking expo-constants
npx expo install nativewind tailwindcss  # se usar NativeWind
```

---

## 3. FIREBASE COM EXPO — GUIA COMPLETO

### 3.1 Dois caminhos: JS SDK vs React Native Firebase

| Critério                          | Firebase JS SDK              | React Native Firebase         |
|-----------------------------------|------------------------------|-------------------------------|
| Funciona no Expo Go               | ✅ Sim                        | ❌ Não (precisa dev build)     |
| Setup                             | Simples (npm install)        | Complexo (native code)        |
| Auth, Firestore, Storage          | ✅ Suportado                  | ✅ Suportado                   |
| Analytics, Crashlytics            | ❌ Não suportado              | ✅ Suportado                   |
| Performance nativa                | JS bridge                    | SDK nativo                    |
| **Recomendação para começar**     | **✅ Use este**               | Só se precisar de Analytics   |

### 3.2 Instalação Firebase JS SDK (recomendado)
```bash
# Expo SDK 53+ requer firebase@^12.0.0
npx expo install firebase
```

> ⚠️ Não use `npm install firebase` — use `npx expo install` para garantir compatibilidade de versão.

### 3.3 Configuração inicial — `firebaseConfig.ts`
```typescript
// firebaseConfig.ts (na raiz do projeto ou em /config)
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
```

### 3.4 Variáveis de ambiente com Expo
```bash
# .env (na raiz — prefixo EXPO_PUBLIC_ obrigatório para ser exposto ao cliente)
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=meuapp.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=meuapp
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=meuapp.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123:android:abc
```

> Adicione `.env` ao `.gitignore`. Nunca comite chaves Firebase no Git.

---

## 4. FIREBASE AUTH

### 4.1 Login com Email e Senha
```typescript
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';

// Criar conta
async function register(email: string, password: string) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

// Login
async function login(email: string, password: string) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

// Logout
async function logout() {
  await signOut(auth);
}
```

### 4.2 Observar estado de autenticação (hook)
```typescript
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebaseConfig';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe; // cleanup — SEMPRE fazer isso
  }, []);

  return { user, loading };
}
```

### 4.3 Proteger rotas com Expo Router
```typescript
// app/_layout.tsx
import { useAuth } from '../hooks/useAuth';
import { Redirect } from 'expo-router';

export default function RootLayout() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Redirect href="/login" />;

  return <Stack />;
}
```

### 4.4 Persistência de Auth no Expo Go
Firebase JS SDK com Expo Go pode ter problemas de persistência. Use `getReactNativePersistence`:
```typescript
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
```
Instalar: `npx expo install @react-native-async-storage/async-storage`

---

## 5. FIRESTORE

### 5.1 Operações CRUD básicas
```typescript
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs,
  updateDoc, deleteDoc, query, where, orderBy, onSnapshot
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// CREATE — adicionar com ID automático
async function createPost(data: { title: string; userId: string }) {
  const docRef = await addDoc(collection(db, 'posts'), {
    ...data,
    createdAt: new Date(),
  });
  return docRef.id;
}

// CREATE — com ID definido
async function createUser(uid: string, data: object) {
  await setDoc(doc(db, 'users', uid), data);
}

// READ — documento único
async function getPost(id: string) {
  const docSnap = await getDoc(doc(db, 'posts', id));
  if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
  return null;
}

// READ — coleção com filtros
async function getPostsByUser(userId: string) {
  const q = query(
    collection(db, 'posts'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// UPDATE
async function updatePost(id: string, data: Partial<Post>) {
  await updateDoc(doc(db, 'posts', id), data);
}

// DELETE
async function deletePost(id: string) {
  await deleteDoc(doc(db, 'posts', id));
}
```

### 5.2 Listener em tempo real (onSnapshot)
```typescript
import { useEffect, useState } from 'react';
import { onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export function usePosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Post));
      setPosts(data);
      setLoading(false);
    });

    return unsubscribe; // cleanup obrigatório
  }, []);

  return { posts, loading };
}
```

### 5.3 Modelo de dados recomendado (coleções)
```
/users/{uid}
  - name: string
  - email: string
  - createdAt: Timestamp
  - photoURL: string | null

/posts/{postId}
  - title: string
  - content: string
  - authorId: string (ref para users/{uid})
  - createdAt: Timestamp
  - likes: number

/chats/{chatId}/messages/{messageId}
  - text: string
  - senderId: string
  - createdAt: Timestamp
```

---

## 6. FIREBASE STORAGE

### 6.1 Upload de imagem (com Expo ImagePicker)
```typescript
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebaseConfig';

async function pickAndUploadImage(userId: string): Promise<string> {
  // 1. Pedir permissão e abrir galeria
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled) throw new Error('Cancelado');

  // 2. Converter URI para blob
  const response = await fetch(result.assets[0].uri);
  const blob = await response.blob();

  // 3. Fazer upload para Firebase Storage
  const storageRef = ref(storage, `avatars/${userId}.jpg`);
  await uploadBytes(storageRef, blob);

  // 4. Retornar URL pública
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
}
```

Instalar: `npx expo install expo-image-picker`

---

## 7. REACT NATIVE FIREBASE (quando usar)

### 7.1 Quando migrar do JS SDK para RN Firebase
- Precisa de **Analytics**, **Crashlytics** ou **Dynamic Links**
- Precisa de performance nativa máxima
- Não usa Expo Go (usa EAS Build / Development Build)

### 7.2 Setup com Expo
```bash
npx expo install expo-dev-client
npx expo install @react-native-firebase/app
# Seguir https://rnfirebase.io/#managed-workflow para configuração nativa
npx expo prebuild --clean   # aplica config plugins antes de build local
```

> ⚠️ React Native Firebase **não funciona no Expo Go**. Requer development build ou EAS Build.

---

## 8. PADRÕES DE TELA COM FIREBASE

### 8.1 Tela de Login completa
```typescript
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const insets = useSafeAreaInsets();

  async function handleLogin() {
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text style={styles.title}>Entrar</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="E-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { color: '#ef4444', marginBottom: 12 },
});
```

### 8.2 Tela de lista com Firestore realtime
```typescript
import { View, FlatList, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { usePosts } from '../hooks/usePosts'; // hook com onSnapshot

export default function HomeScreen() {
  const { posts, loading } = usePosts();

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.sub}>{item.authorId}</Text>
          </View>
        )}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  title: { fontSize: 16, fontWeight: '600' },
  sub: { color: '#888', marginTop: 4 },
});
```

---

## 9. CHECKLIST DO AGENTE ANTES DE GERAR CÓDIGO

Antes de gerar qualquer tela, confirmar:

- [ ] Usa `StyleSheet.create` (não inline styles espalhados)
- [ ] `KeyboardAvoidingView` em formulários com TextInput
- [ ] `useSafeAreaInsets()` para padding do topo/bottom
- [ ] `onAuthStateChanged` com `return unsubscribe` no cleanup
- [ ] `onSnapshot` com `return unsubscribe` no cleanup
- [ ] Estados: `loading`, `error`, e dado principal sempre declarados
- [ ] `FlatList` com `keyExtractor` e `showsVerticalScrollIndicator={false}`
- [ ] Variáveis Firebase em `.env` com prefixo `EXPO_PUBLIC_`
- [ ] `npx expo install` para pacotes (não `npm install` direto)
- [ ] Touch targets mínimo de 44px de altura (acessibilidade)
- [ ] Tratar diferenças iOS vs Android com `Platform.OS`

---

## 10. ESTRUTURA DE PASTAS RECOMENDADA

```
meu-app/
├── app/                    # Expo Router — telas e layouts
│   ├── _layout.tsx         # Layout raiz
│   ├── index.tsx           # Tela inicial (splash/redirect)
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── (tabs)/
│       ├── _layout.tsx
│       ├── home.tsx
│       └── profile.tsx
├── components/             # Componentes reutilizáveis
├── hooks/                  # Hooks customizados (useAuth, usePosts...)
├── services/               # Lógica Firebase (firestore, storage...)
├── config/
│   └── firebaseConfig.ts   # Inicialização Firebase
├── types/                  # TypeScript interfaces
├── constants/              # Cores, tamanhos, strings
├── .env                    # Chaves Firebase (não commitar)
└── app.json                # Configuração Expo
```

---

## 11. COMANDOS FREQUENTES

```bash
# Iniciar dev server
npx expo start

# Instalar dependência com verificação de compatibilidade
npx expo install <pacote>

# Build para produção (iOS)
eas build --platform ios

# Build para produção (Android)
eas build --platform android

# Deploy Firebase (regras Firestore — obrigatório após editar firestore.rules)
npx firebase-tools deploy --only firestore:rules --project SEU_PROJECT_ID

# Deploy índices Firestore (após editar firestore.indexes.json)
npx firebase-tools deploy --only firestore:indexes --project SEU_PROJECT_ID

# Deploy Firebase Functions e Hosting
firebase deploy

# Deploy apenas Functions
firebase deploy --only functions

# Emuladores locais Firebase
firebase emulators:start

# Preview channel (URL temporária por branch)
firebase hosting:channel:deploy preview-branch

# Ver logs Firebase Functions
firebase functions:log
```

---

*Última atualização: abril 2026 (Secao 0 Firebase deploy obrigatorio) | Fontes: reactnative.dev/docs · docs.expo.dev/guides/using-firebase · docs.expo.dev/tutorial*

---

## 12. APRENDIZADOS DO CURSO — React Native com Expo Go (Caio Eduardo)
> Extraído da transcrição do curso em vídeo da playlist PLN5FV-HmjCA8UKWLep7O31PtQYqML8-Wd

### 12.1 Setup inicial do projeto
```bash
# Criar projeto com template TypeScript limpo (sem boilerplate)
npx create-expo-app@latest --template blank-typescript my-list

# Entrar na pasta e abrir no VS Code
cd my-list
code .

# Rodar o projeto (exibe QR Code para Expo Go)
npx expo start
```

> Preferir **Expo Go no celular físico** ao invés de Android Studio — mais rápido, sem configuração de emulador.

### 12.2 Estrutura de pastas do curso
```
src/
  assets/
    images/
      logo.png          ← imagens do app
  components/           ← componentes reutilizáveis
  global/
    themes.ts           ← paleta de cores centralizada
  pages/
    login/
      index.tsx         ← tela de login
      styles.ts         ← estilos separados da tela
```

> Padrão do curso: **separar styles.ts do index.tsx** para cada tela. Mantém o código mais limpo e organizado.

### 12.3 Paleta de cores centralizada — `global/themes.ts`
```typescript
// src/global/themes.ts
export const themes = {
  colors: {
    primary: '#4F67FB',      // azul principal — botões, links
    grey: '#A0A0A0',         // ícones, placeholders
    lightGrey: '#F5F5F5',    // background de inputs
    white: '#FFFFFF',
    black: '#1A1A1A',
    orange: '#FF6B35',       // destaques / alertas suaves
  },
};
```

**Regra do curso:** nunca usar cores hardcoded no componente. Sempre importar de `themes.ts`.
```typescript
// ✅ certo
color: themes.colors.primary

// ❌ errado
color: '#4F67FB'
```

Motivo: quando quiser mudar a cor primária do app inteiro, você muda em um único lugar.

### 12.4 Declaração de tipos para imagens (TypeScript)
Ao importar `.png` no TypeScript, ele reclama que o módulo não existe. Solução:
```typescript
// src/@types/png.d.ts
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';
declare module '*.gif';
```
Crie a pasta `src/@types/` e o arquivo acima. O erro vermelho some sem precisar de configurações extras.

### 12.5 Dimensões responsivas com `Dimensions`
```typescript
import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Usar nas styles para ser responsivo por tamanho de tela
const styles = StyleSheet.create({
  boxTop: {
    width: width,
    height: height * 0.4,    // 40% da altura da tela
  },
  boxMid: {
    width: width,
    height: height * 0.3,    // 30% da altura
  },
  boxBottom: {
    width: width,
    height: height * 0.3,    // 30% da altura
  },
});
```

> Nunca usar pixels fixos para altura de seções grandes — o app vai quebrar em telas diferentes.

### 12.6 Estrutura de layout em 3 blocos (padrão do curso)
O curso ensina a dividir telas em 3 `View`s: topo, meio e base.
```typescript
<View style={styles.container}>
  {/* Topo: logo + título */}
  <View style={styles.boxTop}>
    <Image source={logo} style={styles.logo} resizeMode="contain" />
    <Text style={styles.title}>Bem-vindo de volta</Text>
  </View>

  {/* Meio: formulário */}
  <View style={styles.boxMid}>
    {/* inputs aqui */}
  </View>

  {/* Base: botão + link */}
  <View style={styles.boxBottom}>
    {/* botão e texto de cadastro */}
  </View>
</View>
```

### 12.7 Input com ícone — padrão `boxInput`
Não existe como colocar ícone dentro do `TextInput` nativo. A solução do curso é criar uma `View` em `flexDirection: 'row'` que agrupa o `TextInput` + ícone:

```typescript
import { MaterialIcons } from '@expo/vector-icons';
import { themes } from '../../global/themes';

// Dentro do JSX:
<View style={styles.boxInput}>
  <TextInput
    style={styles.input}
    placeholder="Endereço de e-mail"
    value={email}
    onChangeText={setEmail}
    keyboardType="email-address"
    autoCapitalize="none"
  />
  <MaterialIcons name="email" size={20} color={themes.colors.grey} />
</View>

<View style={styles.boxInput}>
  <TextInput
    style={styles.input}
    placeholder="Senha"
    value={password}
    onChangeText={setPassword}
    secureTextEntry
  />
  <MaterialIcons name="lock" size={20} color={themes.colors.grey} />
</View>
```

```typescript
// styles.ts
boxInput: {
  width: '90%',
  height: 40,
  borderWidth: 1,
  borderRadius: 40,
  borderColor: themes.colors.lightGrey,
  backgroundColor: themes.colors.lightGrey,
  flexDirection: 'row',         // ← ícone e input lado a lado
  alignItems: 'center',
  paddingHorizontal: 10,
  marginTop: 10,
},
input: {
  width: '90%',
  paddingLeft: 5,
},
```

Instalar biblioteca de ícones:
```bash
npx expo install @expo/vector-icons
# já vem no Expo SDK, mas caso precise instalar separado:
npm install react-native-vector-icons
```

### 12.8 Gerador de sombra para botões
O curso indica usar geradores online de `boxShadow` para React Native.
Padrão de sombra elegante para botões:
```typescript
button: {
  width: 250,
  height: 50,
  backgroundColor: themes.colors.primary,
  borderRadius: 40,
  alignItems: 'center',
  justifyContent: 'center',
  // sombra iOS
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.2,
  shadowRadius: 6,
  // sombra Android
  elevation: 5,
},
buttonText: {
  fontSize: 16,
  color: '#fff',
  fontWeight: 'bold',
},
```

### 12.9 Gerenciamento de estado com `useState`
```typescript
import { useState } from 'react';

// Declaração
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [loading, setLoading] = useState(false);

// Vincular ao TextInput — duas formas ensinadas no curso:

// Forma 1 — com arrow function (mais explícita, recomendada)
<TextInput
  value={email}
  onChangeText={(text) => setEmail(text)}
/>

// Forma 2 — passando o setter direto (mais curta)
<TextInput
  value={password}
  onChangeText={setPassword}
/>
```

> Sem `value` + `onChangeText`, o campo fica "travado" e não aceita digitação do usuário.

### 12.10 Função de login com loading e validação
```typescript
import { Alert, ActivityIndicator } from 'react-native';

async function handleLogin() {
  // 1. Validação básica — campos vazios
  if (!email || !password) {
    Alert.alert('Atenção', 'Informe os campos obrigatórios');
    return;
  }

  // 2. Ativar loading
  setLoading(true);

  try {
    // 3. Lógica de autenticação (Firebase ou mock)
    await signInWithEmailAndPassword(auth, email, password);
    // redirecionar após login bem-sucedido
    router.replace('/(tabs)/home');
  } catch (error: any) {
    Alert.alert('Erro', error.message);
  } finally {
    // 4. Desativar loading sempre — mesmo em erro
    setLoading(false);
  }
}
```

### 12.11 Botão com estado de loading inline
```typescript
// Mostrar spinner no botão enquanto carrega
<TouchableOpacity
  style={styles.button}
  onPress={handleLogin}
  disabled={loading}   // ← desabilitar clique duplo
>
  {loading
    ? <ActivityIndicator color="#fff" size="small" />
    : <Text style={styles.buttonText}>Entrar</Text>
  }
</TouchableOpacity>
```

### 12.12 Texto com parte clicável (link inline)
```typescript
// "Não tem conta? Crie agora"
// Só a parte "Crie agora" é clicável e colorida
<Text style={styles.textBottom}>
  Não tem conta?{' '}
  <Text
    style={{ color: themes.colors.primary }}
    onPress={() => router.push('/register')}
  >
    Crie agora
  </Text>
</Text>
```

### 12.13 `flexDirection` — coluna vs linha (resumo visual do curso)
```
flexDirection: 'column' (padrão)    flexDirection: 'row'
┌─────────┐                          ┌────┬────┬────┐
│  Item 1 │                          │ I1 │ I2 │ I3 │
│  Item 2 │                          └────┴────┴────┘
│  Item 3 │
└─────────┘
```

Casos de uso:
- `column` → seções da tela, listas, formulários (padrão)
- `row` → input + ícone, botões lado a lado, navbar

### 12.14 `justifyContent` vs `alignItems` — resumo do curso
```
                    flexDirection: 'column'
justifyContent      → alinha no eixo VERTICAL (cima/baixo)
alignItems          → alinha no eixo HORIZONTAL (esquerda/direita)

                    flexDirection: 'row'
justifyContent      → alinha no eixo HORIZONTAL
alignItems          → alinha no eixo VERTICAL
```

Para centralizar tudo:
```typescript
container: {
  flex: 1,
  justifyContent: 'center',   // centro vertical
  alignItems: 'center',       // centro horizontal
}
```

### 12.15 Tela de Login completa — padrão do curso
```typescript
// src/pages/login/index.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Image, Alert, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { styles } from './styles';
import { themes } from '../../global/themes';
import logo from '../../../assets/images/logo.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Atenção', 'Informe os campos obrigatórios');
      return;
    }
    setLoading(true);
    try {
      // substituir por: await signInWithEmailAndPassword(auth, email, password)
      await new Promise(resolve => setTimeout(resolve, 2000)); // mock
      Alert.alert('Sucesso', 'Logado com sucesso!');
    } catch (error: any) {
      Alert.alert('Erro', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Topo */}
      <View style={styles.boxTop}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Bem-vindo de volta</Text>
      </View>

      {/* Meio — formulário */}
      <View style={styles.boxMid}>
        <Text style={styles.titleInput}>Endereço de e-mail</Text>
        <View style={styles.boxInput}>
          <TextInput
            style={styles.input}
            placeholder="seu@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <MaterialIcons name="email" size={20} color={themes.colors.grey} />
        </View>

        <Text style={styles.titleInput}>Senha</Text>
        <View style={styles.boxInput}>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <MaterialIcons name="lock" size={20} color={themes.colors.grey} />
        </View>
      </View>

      {/* Base — botão */}
      <View style={styles.boxBottom}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.buttonText}>Entrar</Text>
          }
        </TouchableOpacity>

        <Text style={styles.textBottom}>
          Não tem conta?{' '}
          <Text style={{ color: themes.colors.primary }}>Crie agora</Text>
        </Text>
      </View>
    </View>
  );
}
```

```typescript
// src/pages/login/styles.ts
import { StyleSheet, Dimensions } from 'react-native';
import { themes } from '../../global/themes';

const { width, height } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themes.colors.white,
  },
  boxTop: {
    width,
    height: height * 0.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 40,
  },
  boxMid: {
    width,
    height: height * 0.35,
    paddingHorizontal: 37,
  },
  titleInput: {
    marginTop: 20,
    marginLeft: 5,
    color: themes.colors.grey,
  },
  boxInput: {
    width: '90%',
    height: 40,
    borderWidth: 1,
    borderRadius: 40,
    borderColor: themes.colors.lightGrey,
    backgroundColor: themes.colors.lightGrey,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginTop: 10,
  },
  input: {
    width: '90%',
    paddingLeft: 5,
  },
  boxBottom: {
    width,
    height: height * 0.25,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 20,
  },
  button: {
    width: 250,
    height: 50,
    backgroundColor: themes.colors.primary,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  buttonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  textBottom: {
    fontSize: 16,
    marginTop: 20,
    color: themes.colors.grey,
  },
});
```

---

### 12.16 Checklist de boas práticas aprendidas no curso

- [ ] Cores sempre em `global/themes.ts` — nunca hardcoded
- [ ] Styles sempre em `styles.ts` separado do `index.tsx`
- [ ] Dimensões responsivas com `Dimensions.get('window')`
- [ ] Declarar tipos de imagens em `src/@types/png.d.ts`
- [ ] Input com ícone: `View` em `flexDirection: 'row'` agrupando `TextInput` + ícone
- [ ] Sempre ter: `value` + `onChangeText` nos `TextInput` (campos controlados)
- [ ] Botão com `disabled={loading}` para evitar clique duplo
- [ ] `ActivityIndicator` inline no botão durante loading
- [ ] `Alert.alert('Título', 'Mensagem')` para feedbacks do usuário
- [ ] Função de login: validar campos → setLoading(true) → try/catch → finally setLoading(false)

---

## 13. COMPONENTIZAÇÃO — Reutilização de Código (Caio Eduardo — Vídeo 2)

> Conceito central: **nunca copiar e colar o mesmo bloco de código**. Extraia em componente, passe props, reutilize.

### 13.1 Por que componentizar?
- Tela de login tem 2 inputs quase idênticos. A próxima tela terá mais.
- Copiar e colar gera código difícil de manter: mudar 1 detalhe = mudar em N lugares.
- Componente = bloco isolado, reutilizável, com suas próprias props e estilos.

### 13.2 Estrutura de pasta para componentes
```
src/
  components/
    Input/
      index.tsx       ← lógica e JSX do componente
      styles.ts       ← estilos isolados
    Button/
      index.tsx
      styles.ts
```

> Padrão do curso: **cada componente em sua própria pasta**, com `index.tsx` e `styles.ts` separados.

### 13.3 Componente Input reutilizável — com ícone esquerda/direita

#### Tipagem das props com TypeScript
```typescript
// src/components/Input/index.tsx
import React from 'react';
import { View, TextInput, TextInputProps, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ComponentType } from 'react';

// Tipo para o componente de ícone (MaterialIcons, FontAwesome, Octicons...)
type IconComponent = ComponentType<{
  name: any;
  size?: number;
  color?: string;
}>;

// Props do nosso Input = todas as props nativas do TextInput + nossas customizações
type Props = TextInputProps & {
  title?: string;                        // label acima do input
  iconLeft?: IconComponent;             // componente de ícone à esquerda (opcional)
  iconLeftName?: string;                // nome do ícone esquerdo
  iconRight?: IconComponent;            // componente de ícone à direita (opcional)
  iconRightName?: string;               // nome do ícone direito
  onIconLeftPress?: () => void;         // ação ao clicar no ícone esquerdo
  onIconRightPress?: () => void;        // ação ao clicar no ícone direito
};
```

> O `?` em cada prop significa que ela é **opcional** — o componente funciona mesmo sem receber aquela prop.
> O `TextInputProps &` garante que todas as props nativas do TextInput (value, onChangeText, secureTextEntry, etc.) também funcionam.

#### Calculando tamanho dinâmico do input
```typescript
// Calcula width do input baseado em quantos ícones existem
function calculateInputWidth(iconLeft?: IconComponent, iconRight?: IconComponent): string {
  if (iconLeft && iconRight) return '80%';  // dois ícones → input menor
  if (iconLeft || iconRight) return '90%';  // um ícone → input médio
  return '100%';                             // sem ícone → input ocupa tudo
}

// Calcula paddingLeft baseado na presença de ícone esquerdo
function calculatePaddingLeft(iconLeft?: IconComponent): number {
  return iconLeft ? 10 : 5;
}
```

#### Componente Input completo
```typescript
export function Input(props: Props) {
  const {
    title,
    iconLeft: IconLeft,
    iconLeftName,
    iconRight: IconRight,
    iconRightName,
    onIconLeftPress,
    onIconRightPress,
    ...rest   // ← spread do restante: value, onChangeText, secureTextEntry, etc.
  } = props;

  return (
    <>
      {/* Label acima do input — só renderiza se title existir */}
      {title && (
        <Text style={styles.titleInput}>{title}</Text>
      )}

      <View style={styles.boxInput}>
        {/* Ícone esquerdo — só renderiza se existir */}
        {IconLeft && iconLeftName && (
          <TouchableOpacity onPress={onIconLeftPress} style={styles.iconWrapper}>
            <IconLeft name={iconLeftName} size={20} color={themes.colors.grey} />
          </TouchableOpacity>
        )}

        <TextInput
          style={[
            styles.input,
            { width: calculateInputWidth(IconLeft, IconRight) },
            { paddingLeft: calculatePaddingLeft(IconLeft) },
          ]}
          {...rest}   // ← passa todas as props nativas do TextInput
        />

        {/* Ícone direito — só renderiza se existir */}
        {IconRight && iconRightName && (
          <TouchableOpacity onPress={onIconRightPress} style={styles.iconWrapper}>
            <IconRight name={iconRightName} size={20} color={themes.colors.grey} />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}
```

> **`{...rest}`** é o segredo: passa `value`, `onChangeText`, `secureTextEntry`, `keyboardType` e qualquer outra prop nativa diretamente para o `TextInput` sem precisar declarar uma a uma.

#### Styles do Input
```typescript
// src/components/Input/styles.ts
import { StyleSheet } from 'react-native';
import { themes } from '../../global/themes';

export const styles = StyleSheet.create({
  titleInput: {
    marginTop: 20,
    marginLeft: 5,
    color: themes.colors.grey,
    fontSize: 14,
  },
  boxInput: {
    width: '90%',
    height: 40,
    borderWidth: 1,
    borderRadius: 40,
    borderColor: themes.colors.lightGrey,
    backgroundColor: themes.colors.lightGrey,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginTop: 10,
  },
  input: {
    height: '100%',
    paddingLeft: 5,
  },
  iconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

### 13.4 Usando o componente Input na tela de login
```typescript
// src/pages/login/index.tsx
import { Input } from '../../components/Input';
import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.container}>
      {/* ... boxTop com logo ... */}

      <View style={styles.boxMid}>
        {/* Input de e-mail com ícone à direita */}
        <Input
          title="Endereço de e-mail"
          iconRight={MaterialIcons}
          iconRightName="email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="seu@email.com"
        />

        {/* Input de senha com ícone de olho clicável */}
        <Input
          title="Senha"
          iconRight={MaterialIcons}
          iconRightName={showPassword ? 'visibility' : 'visibility-off'}
          onIconRightPress={() => setShowPassword(prev => !prev)}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          placeholder="••••••••"
        />
      </View>

      {/* ... boxBottom com botão ... */}
    </View>
  );
}
```

> Antes eram ~40 linhas de código repetido. Agora são **2 componentes `<Input />`** cada um com ~8 linhas.

### 13.5 Componente Button reutilizável
```typescript
// src/components/Button/index.tsx
import React from 'react';
import {
  TouchableOpacity, TouchableOpacityProps,
  Text, ActivityIndicator
} from 'react-native';
import { styles } from './styles';

type Props = TouchableOpacityProps & {
  text: string;          // texto do botão — obrigatório
  loading?: boolean;     // se true, mostra spinner ao invés do texto
};

export function Button({ text, loading, ...rest }: Props) {
  return (
    <TouchableOpacity
      style={[styles.button, { opacity: rest.disabled ? 0.6 : 1 }]}
      activeOpacity={0.8}
      disabled={loading}   // desabilita durante loading para evitar clique duplo
      {...rest}
    >
      {loading
        ? <ActivityIndicator color="#fff" size="small" />
        : <Text style={styles.buttonText}>{text}</Text>
      }
    </TouchableOpacity>
  );
}
```

```typescript
// src/components/Button/styles.ts
import { StyleSheet } from 'react-native';
import { themes } from '../../global/themes';

export const styles = StyleSheet.create({
  button: {
    width: 250,
    height: 50,
    backgroundColor: themes.colors.primary,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  buttonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
});
```

### 13.6 Usando o componente Button na tela de login
```typescript
import { Button } from '../../components/Button';

// Antes — código repetido
<TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
</TouchableOpacity>

// Depois — componente reutilizável
<Button
  text="Entrar"
  loading={loading}
  onPress={handleLogin}
/>
```

### 13.7 Lógica de mostrar/esconder senha
```typescript
const [showPassword, setShowPassword] = useState(false);

// Toggle simples — usando valor anterior (prev)
const togglePassword = () => setShowPassword(prev => !prev);

// No componente Input:
<Input
  iconRightName={showPassword ? 'visibility' : 'visibility-off'}
  onIconRightPress={togglePassword}
  secureTextEntry={!showPassword}
  value={password}
  onChangeText={setPassword}
/>
```

> Ícones usados: `'visibility'` (olho aberto) e `'visibility-off'` (olho fechado) — ambos do `MaterialIcons`.

### 13.8 Fragment — evitar wrapper desnecessário
```typescript
// ❌ Errado — View desnecessária que adiciona elemento ao layout
return (
  <View>
    <Text>Label</Text>
    <View style={styles.boxInput}>...</View>
  </View>
);

// ✅ Certo — Fragment não adiciona elemento real ao DOM
return (
  <>
    <Text>Label</Text>
    <View style={styles.boxInput}>...</View>
  </>
);

// Ou com import explícito (mesma coisa, mais legível para alguns)
import { Fragment } from 'react';
return (
  <Fragment>
    <Text>Label</Text>
    <View style={styles.boxInput}>...</View>
  </Fragment>
);
```

### 13.9 Renderização condicional inline
```typescript
// Padrão do curso — só renderiza se a prop existir
{title && <Text style={styles.titleInput}>{title}</Text>}

// Equivalente ao if, mas em uma linha (operador &&)
// Se title for undefined/null/'' → não renderiza nada
// Se title tiver valor → renderiza o <Text>

// Para dois valores opcionais:
{iconLeft && iconLeftName && (
  <IconLeft name={iconLeftName} size={20} color={themes.colors.grey} />
)}
```

> Sem essa verificação, o espaço do título ficaria reservado mesmo quando não há título — gerando espaço em branco indesejado.

### 13.10 Spread de props com `...rest`
```typescript
// O ...rest captura TUDO que não foi desestruturado explicitamente
const { title, iconLeft, iconRight, ...rest } = props;

// E passa para o componente nativo automaticamente
<TextInput {...rest} />

// Assim o componente suporta qualquer prop do TextInput sem declarar:
// value, onChangeText, secureTextEntry, keyboardType, autoCapitalize,
// placeholder, maxLength, onFocus, onBlur, autoComplete, etc.
```

### 13.11 Checklist de componentização

- [ ] Identificar padrão de repetição (mesmo bloco de código em 2+ lugares)
- [ ] Criar pasta `components/NomeComponente/` com `index.tsx` e `styles.ts`
- [ ] Definir `type Props` com TypeScript para todas as props recebidas
- [ ] Usar `?` para props opcionais
- [ ] Usar `& TextInputProps` ou `& TouchableOpacityProps` para herdar props nativas
- [ ] Usar `{...rest}` para passar props nativas sem declarar uma a uma
- [ ] Renderização condicional `{prop && <Componente />}` para props opcionais
- [ ] Usar `<>...</>` (Fragment) quando não precisar de wrapper real
- [ ] Calcular tamanhos dinâmicos com função utilitária quando necessário
- [ ] Importar sempre de `'react-native'` — nunca de `'react-native-paper'` por engano

---

---

## 14. NAVEGAÇÃO — Stack + Bottom Tab (Caio Eduardo — Vídeo 3)

> Conceito central: **Stack Navigation** engloba o projeto todo. **Bottom Tab Navigation** fica dentro do Stack, contendo as telas autenticadas.

### 14.1 Tipos de navegação no React Native
| Tipo              | Uso                                          | Biblioteca                          |
|-------------------|----------------------------------------------|-------------------------------------|
| **Stack**         | Pilha de telas (login → home → detalhe)      | `@react-navigation/native-stack`    |
| **Bottom Tabs**   | Abas na parte inferior (home, perfil, etc.)  | `@react-navigation/bottom-tabs`     |
| **Drawer**        | Gaveta lateral (menu hambúrguer)             | `@react-navigation/drawer`          |

### 14.2 Instalação completa
```bash
# 1. Biblioteca principal de navegação
npm install @react-navigation/native

# 2. Dependências do Expo (gesture + screens)
npx expo install react-native-screens react-native-safe-area-context
npx expo install react-native-gesture-handler

# 3. Stack Navigator
npm install @react-navigation/native-stack

# 4. Bottom Tab Navigator
npm install @react-navigation/bottom-tabs
```

Adicionar no topo do `app.tsx` (obrigatório para finalizar instalação):
```typescript
// app.tsx — PRIMEIRA linha, antes de qualquer import
import 'react-native-gesture-handler';
```

### 14.3 Estrutura de pastas de rotas
```
src/
  routes/
    index.tsx          ← Stack Navigator principal (raiz)
    bottomRoutes.tsx   ← Bottom Tab Navigator (telas autenticadas)
  pages/
    login/
    list/
    user/
```

### 14.4 Stack Navigator — raiz do app
```typescript
// src/routes/index.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Login } from '../pages/login';
import { BottomRoutes } from './bottomRoutes';

const Stack = createNativeStackNavigator();

export function Routes() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, backgroundColor: '#fff' }}>
      <Stack.Screen name="login" component={Login} />
      <Stack.Screen name="bottomRoutes" component={BottomRoutes} />
    </Stack.Navigator>
  );
}
```

### 14.5 Bottom Tab Navigator — telas autenticadas
```typescript
// src/routes/bottomRoutes.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { List } from '../pages/list';
import { User } from '../pages/user';
import { CustomTabBar } from '../components/CustomTabBar';

const Tab = createBottomTabNavigator();

export function BottomRoutes() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="list" component={List} />
      <Tab.Screen name="user" component={User} />
    </Tab.Navigator>
  );
}
```

### 14.6 Configurar NavigationContainer no app.tsx
```typescript
// app.tsx
import 'react-native-gesture-handler'; // ← PRIMEIRA linha sempre
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Routes } from './src/routes';

export default function App() {
  return (
    <NavigationContainer>
      <Routes />
    </NavigationContainer>
  );
}
```

### 14.7 navigate vs reset — qual usar após login
```typescript
import { useNavigation } from '@react-navigation/native';

export function Login() {
  const navigation = useNavigation<any>();

  async function handleLogin() {
    // lógica de auth...

    // ❌ navigate — empilha a tela, usuário consegue voltar ao login
    navigation.navigate('bottomRoutes');

    // ✅ reset — substitui a pilha INTEIRA, não permite voltar ao login
    navigation.reset({
      index: 0,
      routes: [{ name: 'bottomRoutes' }],
    });
  }
}
```

> **Regra do curso:** após login bem-sucedido usar sempre **`navigation.reset()`**.
> Com `navigate`, o botão "voltar" leva de volta ao login.
> Com `reset`, a pilha é destruída — comportamento correto para autenticação.

### 14.8 Custom Tab Bar — barra personalizada
```typescript
// src/components/CustomTabBar/index.tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { AntDesign, FontAwesome } from '@expo/vector-icons';
import { themes } from '../../global/themes';

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {

  const go = (screen: string) => navigation.navigate(screen);

  return (
    <View style={styles.tabArea}>

      {/* Aba 0 — Lista */}
      <TouchableOpacity style={styles.tabItem} onPress={() => go('list')}>
        <AntDesign
          name="bars"
          size={32}
          color={themes.colors.primary}
          style={{ opacity: state.index === 0 ? 1 : 0.3 }}
        />
      </TouchableOpacity>

      {/* Botão central flutuante */}
      <TouchableOpacity style={styles.tabItem}>
        <View style={styles.buttonInner}>
          <AntDesign name="plus" size={24} color="#fff" />
        </View>
      </TouchableOpacity>

      {/* Aba 1 — Usuário */}
      <TouchableOpacity style={styles.tabItem} onPress={() => go('user')}>
        <FontAwesome
          name="user"
          size={32}
          color={themes.colors.primary}
          style={{ opacity: state.index === 1 ? 1 : 0.3 }}
        />
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  tabArea: {
    width: '80%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 40,
    paddingVertical: 10,
    marginBottom: 10,
    // sombra iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    // sombra Android
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: themes.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,      // sempre na frente
    marginTop: -30,  // flutua acima da tab bar
  },
});
```

### 14.9 Indicador de aba ativa com state.index
```typescript
// state.index === 0 → primeira aba ativa (list)
// state.index === 1 → segunda aba ativa (user)

// Controlar opacidade do ícone baseado na aba ativa
style={{ opacity: state.index === 0 ? 1 : 0.3 }}

// Se tiver 3+ abas: índices 0, 1, 2...
```

### 14.10 Estrutura hierárquica de navegação
```
NavigationContainer              ← app.tsx
  └── Stack Navigator            ← src/routes/index.tsx
        ├── "login"              ← tela pública (index 0)
        └── "bottomRoutes"       ← Bottom Tab Navigator
              ├── "list"         ← aba 0
              └── "user"         ← aba 1
```

> Stack engloba o Bottom Tab. Login e telas autenticadas são separados.
> Isso garante que `navigation.reset()` funcione corretamente ao fazer login.

### 14.11 Remover header padrão
```typescript
// Para todas as telas do Navigator
<Stack.Navigator screenOptions={{ headerShown: false }}>
<Tab.Navigator screenOptions={{ headerShown: false }}>

// Para uma tela específica
<Stack.Screen name="login" component={Login} options={{ headerShown: false }} />
```

### 14.12 Checklist de navegação

- [ ] `import 'react-native-gesture-handler'` na **primeira linha** do `app.tsx`
- [ ] `<NavigationContainer>` envolve tudo no `app.tsx`
- [ ] Stack Navigator na raiz — engloba login + telas autenticadas
- [ ] Bottom Tab Navigator dentro do Stack — só telas autenticadas
- [ ] Após login usar `navigation.reset()` — nunca `navigation.navigate()`
- [ ] `screenOptions={{ headerShown: false }}` para remover header padrão
- [ ] Custom Tab Bar recebe `{ state, navigation }` via props do Bottom Tab
- [ ] Usar `state.index` para indicar aba ativa (opacidade, cor do ícone)
- [ ] Nomes de rotas em `navigation.navigate()` devem ser **idênticos** aos declarados no Navigator
- [ ] Botão central flutuante: `marginTop: -30` + `zIndex: 99`

---

---

## 15. CONTEXT API — Compartilhar dados entre telas (Caio Eduardo — Vídeo 4)

> Conceito central: **Context** evita "prop drilling" — passar props por vários níveis de componentes. Dados e funções ficam acessíveis em qualquer componente dentro do Provider, sem precisar passar manualmente.

### 15.1 Problema que o Context resolve
Sem Context, para compartilhar uma função entre telas você precisaria:
- Criar o estado/função no componente pai
- Passar como prop para filho → neto → bisneto...
- Replicar código em múltiplos lugares (gambiarra)

```
❌ Sem Context — prop drilling
BottomRoutes
  ├── CustomTabBar (botão +)  ← precisa da função abrirModal
  ├── List                    ← também precisa
  └── User                    ← também precisa

Solução errada: criar o botão dentro das duas telas, replicar modal...
```

```
✅ Com Context — um Provider, qualquer filho acessa
BottomRoutes
  └── ListContextProvider      ← define a função uma vez só
        ├── CustomTabBar       ← usa onOpen diretamente
        ├── List               ← usa onOpen diretamente
        └── User               ← usa onOpen diretamente
```

### 15.2 Estrutura de pastas
```
src/
  context/
    listContext.tsx    ← cria o Context e o Provider
```

### 15.3 Criando o Context e Provider
```typescript
// src/context/listContext.tsx
import React, { createContext, useContext, useState } from 'react';

// 1. Definir o tipo das propriedades do Context
type ListContextProps = {
  onOpen: () => void;           // função para abrir o modal
  modalVisible: boolean;        // estado de visibilidade do modal
  onClose: () => void;          // função para fechar o modal
};

// 2. Criar o Context com valor inicial nulo
export const ListContext = createContext<ListContextProps>({} as ListContextProps);

// 3. Criar o Provider — envolve os componentes que terão acesso
export function ListContextProvider({ children }: { children: React.ReactNode }) {
  const [modalVisible, setModalVisible] = useState(false);

  // Funções que ficam disponíveis para todos os filhos
  const onOpen = () => setModalVisible(true);
  const onClose = () => setModalVisible(false);

  return (
    <ListContext.Provider value={{ onOpen, modalVisible, onClose }}>
      {children}
    </ListContext.Provider>
  );
}

// 4. Hook customizado para consumir o Context (boa prática)
export const useListContext = () => useContext(ListContext);
```

### 15.4 Aplicar o Provider nas rotas
O Provider envolve **apenas** as telas que precisam dos dados.
No caso do curso: só as telas autenticadas (list + user) precisam — não o login.

```typescript
// src/routes/bottomRoutes.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { List } from '../pages/list';
import { User } from '../pages/user';
import { CustomTabBar } from '../components/CustomTabBar';
import { ListContextProvider } from '../context/listContext'; // ← importar

const Tab = createBottomTabNavigator();

export function BottomRoutes() {
  return (
    // ← Provider envolve tudo dentro do Bottom Tab
    <ListContextProvider>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="list" component={List} />
        <Tab.Screen name="user" component={User} />
      </Tab.Navigator>
    </ListContextProvider>
  );
}
```

> Se colocar o Provider no `app.tsx`, os dados ficam acessíveis em **toda** a aplicação (incluindo login).
> Se colocar em `bottomRoutes.tsx`, ficam acessíveis **somente** nas telas autenticadas.
> Escolha o nível correto conforme a necessidade.

### 15.5 Consumir o Context em qualquer componente filho
```typescript
// src/components/CustomTabBar/index.tsx
import { useListContext } from '../../context/listContext';

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { onOpen } = useListContext(); // ← desestrutura só o que precisa

  return (
    <View style={styles.tabArea}>
      {/* ... abas esquerda e direita ... */}

      {/* Botão central — abre o modal via Context */}
      <TouchableOpacity style={styles.tabItem} onPress={onOpen}>
        <View style={styles.buttonInner}>
          <AntDesign name="plus" size={24} color="#fff" />
        </View>
      </TouchableOpacity>

    </View>
  );
}
```

```typescript
// src/pages/list/index.tsx — também pode usar o mesmo Context
import { useListContext } from '../../context/listContext';

export function List() {
  const { modalVisible, onClose } = useListContext();

  return (
    <View style={{ flex: 1 }}>
      {/* Conteúdo da tela */}

      {/* Modal controlado pelo Context */}
      <Modal visible={modalVisible} onRequestClose={onClose}>
        {/* conteúdo do modal */}
      </Modal>
    </View>
  );
}
```

### 15.6 Context para sessão do usuário (caso de uso comum)
O curso menciona que o Context no `app.tsx` normalmente guarda **sessão e dados do usuário**.

```typescript
// src/context/authContext.tsx — padrão para autenticação
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';

type AuthContextProps = {
  user: User | null;
  loading: boolean;
  signed: boolean;
};

export const AuthContext = createContext<AuthContextProps>({} as AuthContextProps);

export function AuthContextProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe; // cleanup obrigatório
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signed: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

```typescript
// app.tsx — Provider de auth envolve tudo
export default function App() {
  return (
    <NavigationContainer>
      <AuthContextProvider>
        <Routes />
      </AuthContextProvider>
    </NavigationContainer>
  );
}

// Nas rotas — redirecionar baseado na sessão
export function Routes() {
  const { signed, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {signed
        ? <Stack.Screen name="bottomRoutes" component={BottomRoutes} />
        : <Stack.Screen name="login" component={Login} />
      }
    </Stack.Navigator>
  );
}
```

### 15.7 Onde colocar cada Provider
| Provider               | Onde colocar        | Acessível em              |
|------------------------|---------------------|---------------------------|
| Auth / Sessão usuário  | `app.tsx`           | Todo o app                |
| Dados de telas autenticadas | `bottomRoutes.tsx` | Só telas autenticadas |
| Dados de um fluxo específico | Componente pai do fluxo | Só esse fluxo  |

### 15.8 Diferença: Context vs Props

| Situação                              | Usar Props | Usar Context |
|---------------------------------------|------------|--------------|
| Componente pai → filho direto         | ✅          | ❌ desnecessário |
| Dados usados em 2+ níveis de profundidade | ❌ prop drilling | ✅ |
| Estado global (auth, tema, modal)     | ❌          | ✅ |
| Componente isolado e reutilizável     | ✅          | ❌ |

### 15.9 Checklist de Context API

- [ ] Criar arquivo em `src/context/nomeContext.tsx`
- [ ] Definir `type ContextProps` com todas as propriedades tipadas
- [ ] Criar o Context com `createContext<ContextProps>({} as ContextProps)`
- [ ] Criar o Provider com `{ children: React.ReactNode }` como prop
- [ ] Exportar hook customizado `export const useXxx = () => useContext(XxxContext)`
- [ ] Envolver as rotas/telas corretas com o Provider (nem mais nem menos)
- [ ] Consumir com `const { prop } = useXxx()` — desestruturar só o necessário
- [ ] Auth Context no `app.tsx` — para toda a aplicação
- [ ] Modal/Feature Context no componente pai mais próximo — não poluir o global
- [ ] Cleanup no `useEffect` do `onAuthStateChanged` — sempre `return unsubscribe`

---

---

## 16. FLATLIST, CARDS, HEADER E MODAL (Caio Eduardo — Vídeo 5)

> Conceito central: **FlatList** para listas performáticas, **componentes Badge/Flag** reutilizáveis, **react-native-modalize** para modal bottom sheet, e **useRef** para controlar componentes imperativos.

### 16.1 Header com Dimensions responsivo
```typescript
import { Dimensions, View, Text } from 'react-native';
import { Input } from '../../components/Input';
import { MaterialIcons } from '@expo/vector-icons';
import { themes } from '../../global/themes';

const { width, height } = Dimensions.get('window');

// No JSX:
<View style={styles.header}>
  <Text style={styles.greeting}>
    Bom dia, <Text style={{ fontWeight: 'bold' }}>Caio</Text>
  </Text>

  <View style={styles.boxInput}>
    <Input
      iconLeft={MaterialIcons}
      iconLeftName="search"
    />
  </View>
</View>

// styles
header: {
  width: '100%',
  height: height / 6,          // ← responsivo: divide a altura da tela
  backgroundColor: themes.colors.primary,
  paddingTop: 20,
  paddingHorizontal: 20,
  alignItems: 'center',
},
greeting: {
  fontSize: 20,
  color: '#fff',
  marginTop: 20,
},
boxInput: {
  width: '80%',
},
```

> Nunca usar altura fixa (ex: `height: 300`) para o header — usar `height / 6` para ser responsivo em qualquer dispositivo.

### 16.2 FlatList vs .map() — quando usar cada um

| Critério             | `.map()`                        | `FlatList`                         |
|----------------------|---------------------------------|------------------------------------|
| Renderização         | Tudo de uma vez                 | Lazy — só o que está visível       |
| Performance          | Ruim com muitos itens           | Ótima com milhares de itens        |
| Quando usar          | Listas pequenas e estáticas     | Listas dinâmicas e longas          |
| Sintaxe              | JavaScript puro                 | Componente React Native            |

> O curso ensina `.map()` como conceito, mas usa **FlatList** na prática por ser a boa prática.

### 16.3 Tipagem dos dados da lista
```typescript
// Definir o tipo do item antes de criar a variável
type PropCard = {
  item: number;          // identificador único (usado como key)
  title: string;
  description: string;
  flag?: 'urgente' | 'opcional' | 'concluído'; // flags opcionais
};

// Dados temporários (futuramente virão do Firestore)
const data: PropCard[] = [
  { item: 0, title: 'Tarefa 1', description: 'Descrição da tarefa 1', flag: 'urgente' },
  { item: 1, title: 'Tarefa 2', description: 'Descrição da tarefa 2', flag: 'opcional' },
  { item: 2, title: 'Tarefa 3', description: 'Descrição da tarefa 3' },
];
```

### 16.4 FlatList com renderItem extraído
```typescript
// Extrair o renderItem para função separada — mantém o JSX limpo
function renderCard({ item }: { item: PropCard }) {
  return (
    <TouchableOpacity style={styles.card} key={item.item}>
      <View style={styles.rowCardLeft}>
        {/* Badge de cor */}
        <Badge color={themes.colors.primary} />

        <View>
          <Text style={styles.titleCard}>{item.title}</Text>
          <Text style={styles.descriptionCard}>{item.description}</Text>
        </View>
      </View>

      {/* Flag — só renderiza se existir */}
      {item.flag && <Flag caption={item.flag} color={themes.colors.red} />}
    </TouchableOpacity>
  );
}

// No JSX:
<FlatList
  data={data}
  keyExtractor={(item) => item.item.toString()}  // ← único, nunca repetido
  renderItem={renderCard}
  style={styles.boxList}
  contentContainerStyle={{ paddingBottom: 20 }}
  showsVerticalScrollIndicator={false}
/>
```

```typescript
// styles
boxList: {
  marginTop: 40,
  paddingHorizontal: 30,
},
card: {
  width: '100%',
  height: 60,
  backgroundColor: '#fff',
  marginTop: 6,
  borderRadius: 10,
  justifyContent: 'center',
  padding: 10,
  borderWidth: 1,
  borderColor: themes.colors.lightGrey,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},
rowCardLeft: {
  width: '70%',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,                 // ← gap: espaçamento entre filhos (RN 0.71+)
},
titleCard: {
  fontSize: 16,
  fontWeight: 'bold',
},
descriptionCard: {
  color: themes.colors.grey,
},
```

> **`gap`** é a propriedade de espaçamento entre filhos no flexbox — mais limpo que usar `marginRight` em cada filho. Disponível no React Native 0.71+.

### 16.5 Componente Badge (bolinha colorida)
```typescript
// src/components/Badge/index.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { themes } from '../../global/themes';

type Props = {
  color?: string;
};

export function Badge({ color }: Props) {
  return (
    <View style={[
      styles.badge,
      { borderColor: color || themes.colors.grey }
    ]} />
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 20,
    height: 20,
    borderRadius: 10,   // metade do width/height = círculo perfeito
    borderWidth: 1,
  },
});
```

### 16.6 Componente Flag (etiqueta de status)
```typescript
// src/components/Flag/index.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { themes } from '../../global/themes';

type Props = {
  caption: string;
  color?: string;
};

export function Flag({ caption, color }: Props) {
  return (
    <TouchableOpacity style={[
      styles.container,
      { backgroundColor: color || themes.colors.grey }
    ]}>
      <Text style={styles.text}>{caption}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 12,
  },
});
```

> **Quando criar componente?** O curso ensina: observe quantas vezes o bloco se repete.
> - Card → aparece só na tela list → pode ficar inline como `renderCard`
> - Badge → pode aparecer em várias telas → vira componente
> - Flag → aparece no card e no modal → vira componente

### 16.7 Modal com react-native-modalize

#### Instalação
```bash
npm install react-native-modalize
# Reanimated já deve estar instalado pelo bottom-tabs
# Se não estiver:
npx expo install react-native-reanimated
```

#### Controle com useRef (não useState)
```typescript
// O Modalize é controlado por ref, não por estado
import { useRef } from 'react';
import { Modalize } from 'react-native-modalize';

const modalizeRef = useRef<Modalize>(null);

// Abrir
modalizeRef.current?.open();

// Fechar
modalizeRef.current?.close();
```

#### Integração com Context — abrir modal de qualquer tela
```typescript
// src/context/listContext.tsx — adicionar ref do modal
import { useRef } from 'react';
import { Modalize } from 'react-native-modalize';

export function ListContextProvider({ children }: { children: React.ReactNode }) {
  const modalizeRef = useRef<Modalize>(null);

  const onOpen = () => modalizeRef.current?.open();
  const onClose = () => modalizeRef.current?.close();

  return (
    <ListContext.Provider value={{ onOpen, onClose }}>
      {children}
      {/* Modal declarado UMA VEZ no Provider — acessível de qualquer tela */}
      <Modalize ref={modalizeRef} adjustToContentHeight>
        <ModalContent onClose={onClose} />
      </Modalize>
    </ListContext.Provider>
  );
}
```

#### Estrutura do conteúdo do Modal
```typescript
// src/components/ModalContent/index.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { MaterialIcons, AntDesign } from '@expo/vector-icons';
import { Input } from '../Input';
import { Flag } from '../Flag';
import { themes } from '../../global/themes';

const { width } = Dimensions.get('window');

type Props = {
  onClose: () => void;
};

export function ModalContent({ onClose }: Props) {
  return (
    <View style={styles.container}>
      {/* Header do modal */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <MaterialIcons name="close" size={30} color={themes.colors.grey} />
        </TouchableOpacity>

        <Text style={styles.title}>Criar tarefa</Text>

        <TouchableOpacity>
          <AntDesign name="check" size={30} color={themes.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Campos */}
      <View style={styles.content}>
        <Input title="Título" />

        {/* Input maior para descrição */}
        <Input
          title="Descrição"
          multiline
          numberOfLines={5}
          height={100}        // ← prop customizada que implementamos no Input
        />

        <Input title="Tempo limite" />

        {/* Flags de prioridade */}
        <View style={styles.containerFlag}>
          <Text style={styles.labelFlag}>Flags</Text>
          <View style={styles.flagRow}>
            <Flag caption="urgente"   color={themes.colors.red} />
            <Flag caption="opcional"  color={themes.colors.primary} />
            <Flag caption="concluído" color={themes.colors.green} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: 40,
  },
  header: {
    width: '100%',
    height: 40,
    paddingHorizontal: 40,
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    width: '100%',
    paddingHorizontal: 20,
  },
  containerFlag: {
    width: '100%',
    padding: 10,
  },
  labelFlag: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  flagRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
```

### 16.8 Estender o componente Input para aceitar height

O modal precisa de um Input com altura maior (multiline). Adicionar prop `height` ao componente:

```typescript
// src/components/Input/index.tsx — adicionar à tipagem
type Props = TextInputProps & {
  title?: string;
  iconLeft?: IconComponent;
  iconLeftName?: string;
  iconRight?: IconComponent;
  iconRightName?: string;
  onIconLeftPress?: () => void;
  onIconRightPress?: () => void;
  height?: number;              // ← nova prop para altura variável
  labelStyle?: TextStyle;       // ← nova prop para estilo do label
};

// No StyleSheet do boxInput, calcular altura dinamicamente:
boxInput: {
  width: '90%',
  height: props.height || 40,  // ← usa height passado ou 40 por padrão
  // ... resto dos estilos
},
```

### 16.9 Propriedade `gap` no Flexbox
```typescript
// gap — espaçamento uniforme entre todos os filhos
// Alternativa mais limpa que usar marginRight/marginBottom em cada filho

rowCardLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,   // 10px entre cada filho
},

flagRow: {
  flexDirection: 'row',
  gap: 8,    // 8px entre as flags
},

// Disponível no React Native 0.71+ / Expo SDK 48+
```

### 16.10 Checklist desta aula

- [ ] Header com `height: height / 6` — nunca altura fixa para blocos grandes
- [ ] `FlatList` com `keyExtractor` usando valor único (`item.toString()`)
- [ ] `renderItem` extraído como função separada — mantém JSX limpo
- [ ] Componentes Badge e Flag em pastas próprias com `styles.ts`
- [ ] `useRef<Modalize>` para controlar modal — não useState
- [ ] Modal declarado UMA VEZ no Provider do Context, não em cada tela
- [ ] `adjustToContentHeight` no Modalize para altura automática
- [ ] `multiline + numberOfLines` para Input de texto longo
- [ ] `gap` no lugar de `marginRight` para espaçamento entre itens em linha
- [ ] Cores adicionais (`red`, `green`, `blueLight`) centralizadas em `themes.ts`

---

---

## 17. FORMULÁRIO DO MODAL — Flags, DateTimePicker e Estado (Caio Eduardo — Vídeo 6)

> Conceito central: **gerenciar estado de formulários complexos** com múltiplos `useState`, renderização dinâmica de arrays com `.map()`, e lidar com **DateTimePicker** em iOS e Android.

### 17.1 Renderização dinâmica de flags com .map()
Em vez de declarar cada Flag manualmente, criar um array de dados e mapear:

```typescript
// Array de flags — adicionar novas flags aqui, aparece automaticamente na UI
const flags = [
  { cap: 'urgente',   color: themes.colors.red     },
  { cap: 'opcional',  color: themes.colors.primary  },
  { cap: 'concluído', color: themes.colors.green    },
];

// renderFlags — função de renderização extraída
const renderFlags = flags.map((item, index) => (
  <TouchableOpacity key={index}>
    <Flag
      caption={item.cap}
      color={item.color}
      selected={selectedFlag === item.cap}  // destaca a flag selecionada
    />
  </TouchableOpacity>
));

// No JSX:
<View style={styles.rowFlags}>
  {renderFlags}
</View>
```

```typescript
// styles
rowFlags: {
  flexDirection: 'row',
  gap: 10,
  marginTop: 10,
},
```

> Padrão do curso: arrays de dados + `.map()` eliminam repetição de código. Adicionar um novo item no array é suficiente.

### 17.2 Propriedade `selected` no componente Flag
Adicionar feedback visual quando a flag está selecionada:

```typescript
// src/components/Flag/index.tsx — adicionar prop selected
type Props = {
  caption: string;
  color?: string;
  selected?: boolean;  // ← nova prop
};

export function Flag({ caption, color, selected }: Props) {
  return (
    <TouchableOpacity style={[
      styles.container,
      { backgroundColor: color || themes.colors.grey },
      selected && styles.selected,   // ← aplica borda se selecionado
    ]}>
      <Text style={styles.text}>{caption}</Text>
    </TouchableOpacity>
  );
}

// styles
selected: {
  borderWidth: 2,
  borderColor: '#000',
},
```

### 17.3 Estado completo do formulário do modal
```typescript
// Dentro do ListContextProvider ou do componente modal
const [title, setTitle]               = useState('');
const [description, setDescription]  = useState('');
const [selectedFlag, setSelectedFlag] = useState<'urgente' | 'opcional' | 'concluído' | ''>('');
const [selectDate, setSelectDate]     = useState('');     // data formatada (string)
const [selectTime, setSelectTime]     = useState('');     // hora formatada (string)

// Estados de controle dos pickers
const [showDatePicker, setShowDatePicker] = useState(false);
const [showTimePicker, setShowTimePicker] = useState(false);

// Datas brutas (tipo Date — necessário para o DateTimePicker)
const [date, setDate] = useState(new Date());
const [time, setTime] = useState(new Date());
```

### 17.4 Instalação do DateTimePicker
```bash
npx expo install @react-native-community/datetimepicker
```

### 17.5 Componente CustomDateTimePicker
O DateTimePicker nativo tem comportamento diferente em iOS e Android.
A solução do curso: **envolver em um Modal transparente** para ter controle total:

```typescript
// src/components/CustomDateTimePicker/index.tsx
import React, { useEffect } from 'react';
import { Modal, View, Platform, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { themes } from '../../global/themes';

type Props = {
  type: 'date' | 'time';             // modo do picker
  show: boolean;                     // se está visível
  setShow: (v: boolean) => void;     // fechar o picker
  date: Date;                        // valor atual
  setDate: (d: Date) => void;        // atualizar o Date bruto
  onDateChange: (d: Date) => void;   // callback com Date selecionado
};

export function CustomDateTimePicker({
  type, show, setShow, date, setDate, onDateChange
}: Props) {

  // Escuta mudanças no date e dispara o callback
  useEffect(() => {
    if (onDateChange) onDateChange(date);
  }, [date, onDateChange]);

  function handleChange(event: any, selectedDate?: Date) {
    setDate(selectedDate || date);
    setShow(false);   // fecha automaticamente após seleção no Android
  }

  return (
    <Modal
      transparent
      visible={show}
      onRequestClose={() => setShow(false)}
    >
      <View style={[
        styles.overlay,
        // Android: fundo transparente (picker tem fundo próprio)
        // iOS: sem fundo transparente
        Platform.OS === 'android' && { backgroundColor: themes.colors.transparent },
      ]}>
        <View style={styles.container}>
          <DateTimePicker
            value={date}
            mode={type}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleChange}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '80%',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    elevation: 5,
  },
});
```

Adicionar cor transparente ao `themes.ts`:
```typescript
// src/global/themes.ts
export const themes = {
  colors: {
    // ... cores existentes ...
    transparent: 'rgba(0,0,0,0.5)',   // ← novo
  },
};
```

### 17.6 Handlers de data e hora
```typescript
// Converter Date para string legível
function handleDateChange(selectedDate: Date) {
  setSelectDate(selectedDate.toLocaleDateString('pt-BR'));
  // Resultado: "13/04/2026"
}

function handleTimeChange(selectedTime: Date) {
  setSelectTime(selectedTime.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }));
  // Resultado: "14:30"
}
```

> **Importante:** o DateTimePicker retorna um objeto `Date`, não uma string.
> Sempre usar `.toLocaleDateString()` ou `.toLocaleTimeString()` para exibir ao usuário.
> Nunca exibir o objeto `Date` diretamente — ficará como `[object Object]`.

### 17.7 Inputs de data/hora — somente leitura com onPress
Os inputs de data e hora não são editáveis pelo teclado — abrirão o picker:

```typescript
<View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>

  {/* Input de data — somente leitura */}
  <Input
    title="Data limite"
    editable={false}          // ← não permite teclado
    value={selectDate}        // ← exibe a data formatada
    onPress={() => setShowDatePicker(true)}   // ← abre o picker
    labelStyle={styles.label}
    width={200}
  />

  {/* Input de hora — somente leitura */}
  <Input
    title="Hora limite"
    editable={false}
    value={selectTime}
    onPress={() => setShowTimePicker(true)}
    labelStyle={styles.label}
    width={100}
  />

</View>

{/* Pickers — renderizam apenas quando show=true */}
{showDatePicker && (
  <CustomDateTimePicker
    type="date"
    show={showDatePicker}
    setShow={setShowDatePicker}
    date={date}
    setDate={setDate}
    onDateChange={handleDateChange}
  />
)}

{showTimePicker && (
  <CustomDateTimePicker
    type="time"
    show={showTimePicker}
    setShow={setShowTimePicker}
    date={time}
    setDate={setTime}
    onDateChange={handleTimeChange}
  />
)}
```

### 17.8 Corrigir bug do KeyboardAvoidingView no modal
O modal bugava quando o teclado subia. Solução do curso:

```typescript
import { KeyboardAvoidingView, Platform, Dimensions } from 'react-native';

const { height } = Dimensions.get('window');

// Envolver o conteúdo do modal com KeyboardAvoidingView
<Modalize
  ref={modalizeRef}
  snapPoint={height / 1.7}       // ← altura dinâmica (não fixa)
  // adjustToContentHeight foi removido pois causava bug
>
  <KeyboardAvoidingView
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  >
    {/* conteúdo do modal */}
  </KeyboardAvoidingView>
</Modalize>
```

> `adjustToContentHeight` no Modalize causa bugs quando o teclado sobe.
> Usar `snapPoint={height / 1.7}` como alternativa mais estável.

### 17.9 `editable={false}` nos TextInputs de exibição
```typescript
// Impede o usuário de digitar diretamente no campo
// Útil para campos que só são preenchidos via picker ou seleção
<TextInput
  editable={false}    // ← campo somente leitura
  value={selectDate}
/>

// A diferença de onPress vs onChangeText:
// onChangeText → usuário digita → atualiza estado
// onPress → usuário toca → abre picker/modal → atualiza estado indiretamente
```

### 17.10 useEffect para sincronizar callbacks
```typescript
// Padrão do curso para notificar o pai quando um valor interno muda
useEffect(() => {
  if (onDateChange) {
    onDateChange(date);   // dispara callback sempre que 'date' muda
  }
}, [date, onDateChange]); // ← array de dependências: executa quando esses valores mudam
```

> `useEffect` com array de dependências executa:
> - Na montagem do componente (sempre)
> - Toda vez que qualquer valor do array de dependências mudar

### 17.11 Checklist do formulário modal

- [ ] Um `useState` por campo do formulário
- [ ] Estados separados para: valor exibido (string) e valor bruto (Date)
- [ ] `editable={false}` em inputs preenchidos por picker
- [ ] `onPress` no Input de data/hora para abrir o picker
- [ ] `.toLocaleDateString('pt-BR')` para formatar data para exibição
- [ ] `.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })` para hora
- [ ] `Platform.OS === 'ios'` para comportamento diferente entre plataformas
- [ ] `CustomDateTimePicker` encapsulado em Modal transparente
- [ ] `useEffect([date, onDateChange])` para sincronizar callbacks
- [ ] `KeyboardAvoidingView` dentro do modal para evitar bug do teclado
- [ ] `snapPoint={height / 1.7}` no Modalize em vez de `adjustToContentHeight`
- [ ] Flags renderizadas com `.map()` a partir de array — nunca hardcoded uma a uma

---

---

## 18. PADRÕES DO PROJETO REAL — LashMatch (Referência Principal)

> Esta seção documenta os padrões reais usados no app **LashMatch** — um app de análise facial com IA para lash designers. Todo código novo deve seguir esses padrões.

---

### 18.1 Identidade visual e cores

```typescript
// Paleta principal do LashMatch — usar sempre estas cores
const COLORS = {
  primary:     '#D63384',   // rosa principal — botões, destaques, ícones
  background:  '#000000',   // fundo geral — telas são pretas
  surface:     '#1a1a1a',   // cards, modais, inputs
  border:      '#333333',   // bordas de cards e inputs
  borderLight: '#222222',   // bordas mais sutis
  text:        '#FFFFFF',   // texto principal
  textMuted:   '#9e9e9e',   // placeholders, subtítulos
  textSecond:  '#AAAAAA',   // textos secundários
  error:       '#ff4d4d',   // mensagens de erro
  success:     '#4ade80',   // confirmações, modo manual
};
```

---

### 18.2 Estrutura de pastas real do projeto

```
LashMatch/
├── app/
│   ├── _layout.tsx              ← Stack raiz com tema dark
│   ├── index.tsx                ← Splash/redirect com onAuthStateChanged
│   ├── Login.tsx                ← Login + cadastro
│   ├── cadastroUsuario.tsx      ← Formulário de cadastro
│   ├── recuperarSenha.tsx       ← Recuperação de senha
│   ├── camera.tsx               ← Câmera + captura de foto
│   ├── analysisResult.tsx       ← Resultado da análise IA
│   ├── (tabs)/
│   │   ├── _layout.tsx          ← Tab Navigator com tema dark
│   │   ├── index.tsx            ← Home (clientes recentes + nova análise)
│   │   ├── clientes.tsx         ← Lista completa de clientes
│   │   ├── explore.tsx          ← Explorar/Discover
│   │   ├── pagamento.tsx        ← Gestão de plano/pagamento
│   │   └── perfilUsuario.tsx    ← Perfil da lash designer
│   ├── assistente/              ← Assistente manual (9 passos)
│   │   ├── _layout.tsx
│   │   ├── passo1_rosto.tsx
│   │   └── ... passo9
│   ├── clientes/
│   │   └── [id].tsx             ← Perfil + histórico da cliente
│   ├── pagameto/                ← Fluxo de pagamento
│   │   ├── cartao.tsx
│   │   └── cancelamento.tsx
│   └── lib/                     ← Regras de negócio puras
│       ├── tamanhoFiosRules.ts
│       ├── colorimetriaRules.ts
│       ├── curvaturaRules.ts
│       └── visagismoRules.ts
├── components/
│   ├── CameraMolds.tsx          ← Moldes de rosto para câmera
│   ├── ModalConfirmacaoGlobal.tsx
│   ├── ModalDatePicker.tsx
│   └── SelectModal.tsx
├── utils/
│   ├── firebaseConfig.ts        ← Inicialização Firebase (fonte única)
│   ├── config.ts                ← URLs das Cloud Functions
│   ├── options.ts               ← Opções de selects
│   └── calcularIdade.ts / formatarData.ts / etc
├── shared/mappers/              ← Conversões de dados
├── functions/SRC/index.ts       ← Cloud Functions (Node.js + Gemini)
└── assets/
    ├── logos/lashmatch.svg
    └── lashes/                  ← Imagens dos estilos de cílios
```

---

### 18.3 Configuração Firebase — padrão correto

```typescript
// utils/firebaseConfig.ts — ÚNICA fonte de verdade
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId:     process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const app       = initializeApp(firebaseConfig);
export const auth      = getAuth(app);
export const firestore = getFirestore(app);
export const storage   = getStorage(app);
```

```typescript
// ✅ USO CORRETO — importar do config centralizado
import { auth, firestore, storage, app } from '../../utils/firebaseConfig';

// ❌ ERRADO — reinicializar dentro do componente
const auth = getAuth(app);       // NÃO FAZER
const db = getFirestore(app);    // NÃO FAZER
```

> **Regra crítica do LashMatch:** `getAuth(app)` e `getFirestore(app)` chamados dentro de componentes são um anti-padrão encontrado no projeto. Todo código novo deve importar `auth` e `firestore` diretamente do `firebaseConfig.ts`.

---

### 18.4 URLs das Cloud Functions — config centralizado

```typescript
// utils/config.ts
export const CLOUD_FUNCTIONS = {
  uploadClientPhoto:    process.env.EXPO_PUBLIC_UPLOAD_FOTO,
  analisarRosto:        process.env.EXPO_PUBLIC_ANALISE_URL,
  assistenteVisagismo:  process.env.EXPO_PUBLIC_CHAT_URL,
};

// Uso nas telas:
import { CLOUD_FUNCTIONS } from '../utils/config';
const response = await fetch(CLOUD_FUNCTIONS.analisarRosto!, { ... });
```

---

### 18.5 Estrutura Firestore do LashMatch

```
// Coleção de usuários (lash designers)
usuarios/{uid}
  - nome: string
  - sobrenome: string
  - email: string
  - (outros dados do cadastro)

// Clientes de cada lash designer (subcoleção isolada por usuário)
artifacts/{appId}/users/{uid}/clientes/{clienteId}
  - nome: string
  - nomeCompleto: string
  - nomePrimeiro: string
  - sobrenome: string
  - telefone: string           // formato: "(11) 99999-9999"
  - dataNascimento: string     // formato: "DD/MM/AAAA"
  - tomPele: TomPele
  - fotoUrl: string
  - dataCadastro: Timestamp    // serverTimestamp()
  - ultimaVisita: Timestamp    // serverTimestamp()
  - ultimaAnalise: object | null

// Histórico de análises de cada cliente
artifacts/{appId}/users/{uid}/clientes/{clienteId}/historico/{analiseId}
  - estilo: string
  - formatoRosto: string
  - eixo / profundidade / alinhamento / distanciamento
  - curvaturasRecomendadas: object
  - colorimetria: object
  - fotoUrl: string
  - data: Timestamp
  - modoAnalise: 'ia' | 'manual'
```

> **Padrão de path do LashMatch:** `artifacts/${app.options.appId}/users/${user.uid}/clientes`
> Sempre pegar o `appId` via `app.options.appId` — nunca hardcodar.

---

### 18.6 Pattern de autenticação — `app/index.tsx`

O `index.tsx` é a tela de splash que redireciona baseado no estado de auth:

```typescript
// app/index.tsx — padrão LashMatch
import { useRouter } from 'expo-router';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { app } from '../utils/firebaseConfig';

export default function Index() {
  const router = useRouter();
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace('/(tabs)');
      } else {
        router.replace('/Login');
      }
      setInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#D63384" />
      </View>
    );
  }

  return null;
}
```

---

### 18.7 Pattern de layout raiz — `app/_layout.tsx`

```typescript
// app/_layout.tsx — tema dark global
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen name="index"          options={{ headerShown: false }} />
        <Stack.Screen name="Login"          options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)"         options={{ headerShown: false }} />
        <Stack.Screen name="camera"         options={{ headerShown: false }} />
        <Stack.Screen name="analysisResult" options={{ headerShown: false }} />
        <Stack.Screen name="clientes/[id]"  options={{ title: 'Perfil da Cliente', headerBackTitle: 'Voltar' }} />
      </Stack>
    </>
  );
}
```

---

### 18.8 Sistema de estilos — mistura proposital de `twrnc` + `StyleSheet`

O LashMatch usa **dois sistemas de estilo** intencionalmente:
- `twrnc` (`tw`) para layouts rápidos e responsivos inline
- `StyleSheet.create` para componentes complexos e reutilizáveis

```typescript
import tw from 'twrnc';
import { StyleSheet } from 'react-native';

// tw() — para layouts inline, cores dinâmicas do tema
<View style={tw`flex-1 bg-black px-4`}>
<Text style={tw`text-white text-xl font-bold`}>

// StyleSheet.create — para estilos fixos e reutilizados
<View style={styles.modalContainer}>
<Text style={styles.modalTitle}>

// Mistura (padrão frequente no LashMatch)
<TouchableOpacity style={[styles.modalButton, tw`bg-[#D63384] border-0`]}>
```

```typescript
// styles padrão de modal no LashMatch
const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    backgroundColor: '#0d0d0d',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 24,
    maxHeight: '82%',
    borderWidth: 1,
    borderColor: '#222',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    marginTop: 24,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    color: '#fff',
    marginBottom: 14,
  },
  modalButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
});
```

---

### 18.9 Padrão de tela com FlatList + onAuthStateChanged + useFocusEffect

Padrão usado em `clientes.tsx` e `index.tsx`:

```typescript
import { useFocusEffect, useRouter } from 'expo-router';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { collection, getFirestore, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, SafeAreaView } from 'react-native';
import { app } from '../../utils/firebaseConfig';

export default function ClientesScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [clients, setClients] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Pega usuário logado
  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setIsLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  // 2. Recarrega dados toda vez que a tela recebe foco
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      setIsLoading(true);

      const db = getFirestore(app);
      const appId = app.options.appId!;
      const ref = collection(db, 'artifacts', appId, 'users', user.uid, 'clientes');
      const q = query(ref, orderBy('ultimaVisita', 'desc'));

      const unsubscribeDB = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Cliente));
        setClients(list);
        setIsLoading(false);
      });

      return () => unsubscribeDB();
    }, [user])
  );

  return (
    <SafeAreaView style={tw`flex-1 bg-black`}>
      <FlatList
        data={clients}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (/* card da cliente */)}
      />
    </SafeAreaView>
  );
}
```

---

### 18.10 Interfaces TypeScript do projeto

```typescript
// Tipos principais do LashMatch
type TomPele = 'Muito clara' | 'Clara' | 'Média' | 'Morena clara' | 'Morena' | 'Preta';

interface Cliente {
  id: string;
  nome: string;
  nomeCompleto?: string;
  nomePrimeiro?: string;
  sobrenome?: string;
  telefone?: string | null;
  dataNascimento?: string | null;
  tomPele?: TomPele;
  fotoUrl?: string;
  dataCadastro?: any;       // Timestamp do Firestore
  ultimaVisita?: any;       // Timestamp do Firestore
  ultimaAnalise?: {
    estilo: string;
    formatoRosto: string;
  } | null;
}

interface AnaliseHistorico {
  id: string;
  data: any;
  modoAnalise?: 'ia' | 'manual';
  estilo: string;
  formatoRosto: string;
  eixo: string;
  profundidade: string;
  alinhamento: string;
  distanciamento: string;
  // ... demais campos de análise
}

// Enum para controle de views no modal (padrão LashMatch)
enum ModalView {
  OPTIONS    = 'options',
  NEW        = 'new',
  EXISTING   = 'existing',
  SELECT_MODE = 'select_mode',
}
```

---

### 18.11 Modal nativo com múltiplas views (padrão LashMatch)

O LashMatch usa um único `<Modal>` com um `enum` controlando o conteúdo — evita abrir múltiplos modais:

```typescript
const [isModalVisible, setIsModalVisible] = useState(false);
const [modalView, setModalView] = useState<ModalView>(ModalView.OPTIONS);

// Função que renderiza o conteúdo correto baseado no estado
const renderModalContent = () => {
  if (modalView === ModalView.OPTIONS) return <OptionsView />;
  if (modalView === ModalView.NEW)     return <NewClientForm />;
  if (modalView === ModalView.EXISTING) return <ExistingClientList />;
  if (modalView === ModalView.SELECT_MODE) return <SelectModeView />;
  return null;
};

// JSX do modal
<Modal
  animationType="slide"
  transparent
  visible={isModalVisible}
  onRequestClose={() => setIsModalVisible(false)}
>
  <KeyboardAvoidingView
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    style={styles.modalBackdrop}
  >
    <View style={styles.modalContainer}>
      {/* Lista usa View direta; formulários usam ScrollView */}
      {modalView === ModalView.EXISTING ? (
        <View>{renderModalContent()}</View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled">
          {renderModalContent()}
        </ScrollView>
      )}
    </View>
  </KeyboardAvoidingView>
</Modal>
```

> **Insight do LashMatch:** quando o modal contém uma `FlatList`, colocá-la dentro de `ScrollView` quebra a rolagem. Usar `View` direta com `height` fixo para o container da lista.

---

### 18.12 Navegação com parâmetros (padrão LashMatch)

```typescript
// Navegar passando múltiplos parâmetros
router.push({
  pathname: '/camera',
  params: {
    clientId:   selectedClientId,
    userId:     user.uid,
    modo:       'ia',          // 'ia' | 'manual'
    createdNow: 'true',        // strings porque params são sempre string
  },
});

// Receber parâmetros com tipagem
const { clientId, modo = 'ia', userId, createdNow } = useLocalSearchParams<{
  clientId:    string;
  modo?:       'ia' | 'manual';
  userId?:     string;
  createdNow?: string;         // 'true' | 'false'
}>();

// Converter string para boolean
const isNewClient = createdNow === 'true';

// Navegar para perfil de cliente (rota dinâmica)
router.push(`/clientes/${clientId}`);
```

---

### 18.13 Formatação e validação de dados BR (padrão LashMatch)

```typescript
// Telefone brasileiro — máscara automática
function normalizePhoneBR(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d.length <= 2)  return `(${d}`;
  if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

function isValidPhoneBR(v: string): boolean {
  const d = v.replace(/\D/g, '');
  return d.length === 10 || d.length === 11;
}

// Data de nascimento — máscara DD/MM/AAAA
function formatBirthDateBR(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0,2)}/${digits.slice(2)}`;
  return `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}`;
}

function isValidBirthDateBR(v: string): boolean {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return false;
  const [dd, mm, yyyy] = v.split('/').map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
}

// Nome — capitalizar cada palavra
function capitalizeName(name: string): string {
  return name.trim().split(/\s+/)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
}

// Primeiro nome
function getFirstName(fullName: string | null): string {
  if (!fullName) return 'Lash';
  const first = fullName.split(' ')[0];
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}
```

---

### 18.14 Cloud Functions com Gemini — padrão do backend

```typescript
// functions/SRC/index.ts — estrutura das Cloud Functions
import { GoogleGenAI } from '@google/genai';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();

// Secrets seguros (nunca no código, sempre no Firebase)
const apiKey = defineSecret('GEMINI_API_KEY');

// Cloud Function de análise facial
export const analisarRosto = onRequest(
  { secrets: [apiKey], cors: true },
  async (req, res) => {
    const ai = new GoogleGenAI({ apiKey: apiKey.value() });
    // ... lógica de análise com Gemini
  }
);
```

---

### 18.15 Padrão de input com opacity baseado em validação

```typescript
// Botão desabilitado visualmente quando campos vazios — padrão LashMatch
<TouchableOpacity
  style={[styles.button, { opacity: !email || !senha ? 0.4 : 1 }]}
  onPress={handleLogin}
  disabled={!email || !senha}
>
  <Text style={styles.buttonText}>Entrar</Text>
</TouchableOpacity>
```

---

### 18.16 Chips de seleção (tom de pele, flags) — padrão LashMatch

```typescript
// Chips com estado selecionado — grid responsivo
<View style={styles.toneGrid}>
  {TONS_PELE.map((tone) => (
    <TouchableOpacity
      key={tone}
      onPress={() => setNewClientSkinTone(tone)}
      style={[
        styles.toneChip,
        newClientSkinTone === tone && styles.toneChipSelected,
      ]}
    >
      <Text style={[
        styles.toneChipText,
        newClientSkinTone === tone && styles.toneChipTextSelected,
      ]}>
        {tone}
      </Text>
    </TouchableOpacity>
  ))}
</View>

// styles
toneGrid:             { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
toneChip:             { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#111', borderWidth: 1, borderColor: '#333' },
toneChipSelected:     { backgroundColor: '#D63384', borderColor: '#D63384' },
toneChipText:         { color: '#ddd', fontWeight: '600', fontSize: 13 },
toneChipTextSelected: { color: '#fff' },
```

---

### 18.17 Checklist de código — padrões LashMatch

**Sempre fazer:**
- [ ] Importar `auth`, `firestore`, `storage` do `utils/firebaseConfig.ts`
- [ ] Usar `app.options.appId` para montar o path do Firestore
- [ ] Usar `serverTimestamp()` para campos de data no Firestore
- [ ] Usar `useFocusEffect` + `useCallback` para recarregar dados ao voltar para a tela
- [ ] Cleanup de `onSnapshot` e `onAuthStateChanged` com `return () => unsubscribe()`
- [ ] Usar `tw` para layouts e `StyleSheet` para componentes com muitos estilos
- [ ] Fundo preto (`#000`) em todas as telas
- [ ] Cor primária `#D63384` em destaques e botões de ação principal
- [ ] `SafeAreaView` como wrapper principal das telas — preferir `react-native-safe-area-context` (o `SafeAreaView` de `react-native` está **deprecated** no RN novo)
- [ ] `KeyboardAvoidingView` + `ScrollView keyboardShouldPersistTaps="handled"` em modais com formulário
- [ ] `Platform.OS === 'ios' ? 'padding' : 'height'` no `behavior` do `KeyboardAvoidingView`

**Nunca fazer:**
- [ ] ❌ `const auth = getAuth(app)` dentro de componentes
- [ ] ❌ `const db = getFirestore(app)` dentro de componentes
- [ ] ❌ Hardcodar `appId` no path do Firestore
- [ ] ❌ Colocar `FlatList` dentro de `ScrollView` (quebra a rolagem)
- [ ] ❌ Cores fora da paleta definida em `COLORS`
- [ ] ❌ Usar `navigation.navigate` após login — sempre `router.replace`

---

### 18.18 Padrão de módulo de estoque (LashMatch)

> Implementação base registrada em `app/(tabs)/estoque.tsx`.

#### Rota e navegação
- Nova aba: `/(tabs)/estoque`
- Registrar no `app/(tabs)/_layout.tsx` com ícone (`Ionicons`, ex.: `cube-outline`).

#### Path Firestore (padrão obrigatório)
```typescript
const appId = app.options.appId;
const ref = collection(firestore, 'artifacts', appId, 'users', user.uid, 'estoque');
```

> Nunca hardcodar `appId`; sempre usar `app.options.appId`.

#### Estrutura do documento de produto
```typescript
interface ProdutoEstoque {
  id: string;
  nome: string;
  tipo: 'Cílios' | 'Cola para cílios';
  quantidade: number;
  minimo: number;
  ativo: boolean;
}
```

Campos persistidos:
- `nome`, `tipo`, `quantidade`, `minimo`, `ativo`
- `criadoEm`, `atualizadoEm` com `serverTimestamp()`

#### Seed inicial de produtos
- Ao abrir a tela e a coleção estar vazia, inserir automaticamente:
  - `Cílios`
  - `Cola para cílios`

#### Comportamento de tela (MVP estoque)
- Listagem com `FlatList` e cards por produto
- CRUD básico:
  - inserir produto
  - editar produto
  - ajustar quantidade (`+1` / `-1`)
  - inativar produto (sem delete físico)
- Busca por nome (`TextInput`)
- Filtro por tipo com chips (`Todos`, `Cílios`, `Cola para cílios`)
- Regra de alerta: `quantidade <= minimo`
  - destacar card
  - badge de "Estoque baixo"
  - banner de alerta no topo

#### Padrões visuais
- Tela em fundo preto (`#000`)
- Destaques e CTA com primária `#D63384`
- Superfície de cards/modais em tons escuros (`#1a1a1a` / `#0d0d0d`)
- Modal com `KeyboardAvoidingView` + `ScrollView keyboardShouldPersistTaps="handled"`

---

## 19. ERROS CONHECIDOS E SOLUÇÕES

### 19.1 `Cannot find module 'expo-router/internal/routing'`

| | |
|---|---|
| **Sintoma** | Ao rodar `npx expo start`, o Metro ou o `@expo/cli` falha com `Error: Cannot find module 'expo-router/internal/routing'` (ou equivalente ao carregar `@expo/router-server`). |
| **Causa** | **Incompatibilidade de versão do pacote `expo-router` com o SDK do Expo.** A partir do Expo SDK 55, o número de versão do **`expo-router` alinha-se ao SDK** (ex.: `~55.0.x`), não à série antiga `5.x`. O `@expo/cli` depende de `@expo/router-server`, que importa `expo-router/internal/routing`. Esses submódulos `internal/*` existem apenas no pacote **`expo-router` v55+** empacotado para o SDK 55. Se o `package.json` tiver `expo-router@~5.1.x` (legado) junto com `expo@~55`, o pacote instalado **não** contém `internal/routing.js` → resolução de módulo quebra. |
| **Solução** | 1. No projeto, alinhar o router ao SDK: ** `npx expo install expo-router` ** (usa `bundledNativeModules` / compatibilidade do SDK). 2. Confirmar no `package.json` algo como **`"expo-router": "~55.0.12"`** (ou a faixa que o Expo sugerir para o seu SDK). 3. **Não** fixar manualmente `expo-router@5.x` quando o `expo` for 55.x. 4. Ao criar projeto novo ou adicionar dependências, preferir sempre **`npx expo install <pacote>`** para módulos nativos/expo, em vez de `npm install` com versão copiada de outro major. |

### 19.2 Firebase Hosting + Expo Web (pasta `dist`, `rewrites`, PowerShell)

| | |
|---|---|
| **Contexto** | O LashMatch usa **Expo Router** com **`app.json` → `web.output`: `"static"`**. O comando **`npx expo export --platform web`** gera os arquivos em **`dist/`** na raiz do projeto (não use a pasta `public` antiga do Hosting para o bundle web). |
| **`firebase.json`** | Manter `firestore` / `functions` / `emulators` como já existem; em **`hosting`**: `"public": "dist"`, **`rewrites`**: `[{ "source": "**", "destination": "/index.html" }]` para rotas SPA que não gerarem HTML próprio. Sem isso, rotas como `/agendar` podem retornar 404 no servidor. |
| **Deploy** | Na raiz: `npx expo export --platform web` → `firebase deploy --only hosting`. Projeto de referência: **`lashmatch-627fd`** → URL **`https://lashmatch-627fd.web.app`** (e `https://lashmatch-627fd.firebaseapp.com`). |
| **`/agendar` na web** | A rota **`/agendar`** é servida pelo export estático (pasta `dist/agendar`). Sem **`?uid=`** a UI mostra *Link inválido* — comportamento esperado. Link público completo: `https://<projeto>.web.app/agendar?uid=<UID_FIREBASE_AUTH_DA_PROFISSIONAL>`. Definir **`EXPO_PUBLIC_AGENDAR_PUBLIC_BASE_URL=https://<projeto>.web.app`** no `.env` para o app mobile gerar o mesmo link ao copiar/compartilhar. |
| **PowerShell (Windows)** | Em versões onde **`&&`** não é aceito entre comandos, usar **`Set-Location caminho; npx expo export --platform web`** (ponto e vírgula) em vez de `cd ... && ...`. |
| **Hosting mostra site errado / vazio** | Confirmar que **`firebase.json` → `hosting.public`** aponta para **`dist`** após o export (não `public`). Rodar export de novo antes do deploy se mudou rotas ou env. |
| **Credenciais Firebase** | Se `firebase deploy` falhar com erro de login, rodar **`firebase login`** e garantir que **`.firebaserc`** aponta o **`default`** para o projeto correto. |

---

## 20. CALENDÁRIO NO REACT NATIVE — Padrão para agentes (react-native-calendars)

> Baseado em prática de implementação com `react-native-calendars`, adaptado para os padrões visuais e arquiteturais do LashMatch.

### 20.1 Quando usar no LashMatch

Use calendário quando precisar de:
- seleção de data para agendamento de retorno;
- filtro de histórico por dia;
- definição de prazo/validade em fluxo de estoque/serviços.

### 20.2 Instalação (padrão Expo)

```bash
# No projeto Expo, preferir expo install quando aplicável
npx expo install react-native-calendars
```

### 20.3 Padrão mínimo de implementação

```typescript
import { useState } from 'react';
import { Calendar, CalendarUtils } from 'react-native-calendars';

const INITIAL_DATE = CalendarUtils.getCalendarDateString(new Date()); // YYYY-MM-DD

export function LashCalendar() {
  const [selectedDate, setSelectedDate] = useState(INITIAL_DATE);

  return (
    <Calendar
      current={INITIAL_DATE}
      onDayPress={(day) => setSelectedDate(day.dateString)}
      markedDates={{
        [selectedDate]: { selected: true },
      }}
    />
  );
}
```

### 20.4 Tema visual obrigatório (LashMatch)

Para manter consistência com Seção 18:
- fundo da tela `#000000`;
- cards/superfícies `#1a1a1a`;
- cor primária de destaque `#D63384`;
- textos claros (`#FFFFFF`) e secundários em cinza.

Exemplo de tema do calendário:
```typescript
theme={{
  calendarBackground: '#1a1a1a',
  monthTextColor: '#FFFFFF',
  dayTextColor: '#FFFFFF',
  textDisabledColor: '#666666',
  selectedDayBackgroundColor: '#D63384',
  selectedDayTextColor: '#FFFFFF',
  todayTextColor: '#D63384',
  arrowColor: '#D63384',
}}
```

### 20.5 Boas práticas para agentes ao gerar tela com calendário

- sempre controlar data selecionada com `useState`;
- usar `markedDates` para feedback visual da data ativa;
- quando necessário, usar `minDate` para bloquear datas passadas;
- envolver a tela em `SafeAreaView` com fundo preto;
- manter mistura de `twrnc` + `StyleSheet` (padrão LashMatch);
- se houver formulário junto, usar `KeyboardAvoidingView` com:
  - iOS: `padding`
  - Android: `height`

### 20.6 Não fazer

- não quebrar paleta da Seção 18 com tema claro;
- não usar cores hardcoded fora do padrão (`#D63384`, `#000`, `#1a1a1a`, etc.);
- não gerar calendário isolado do contexto de negócio (sempre pensar em agendamento, histórico, prazos ou filtros reais do LashMatch).

---

---

## 21. NOTIFICAÇÕES PUSH E LOCAIS — Expo Notifications

> Fonte: docs.expo.dev/push-notifications/overview · docs.expo.dev/versions/latest/sdk/notifications
> Caso de uso principal: alertas de agendamento em salão de beleza, lembretes de tarefas, notificações de novos itens.

### 21.1 Dois tipos de notificação

| Tipo | Quando usar | Funciona no Expo Go? |
|------|-------------|----------------------|
| **Local** | Agendadas no próprio dispositivo (ex: lembrete de consulta) | ✅ Sim |
| **Push (remota)** | Enviadas por servidor externo para o dispositivo | ❌ Não no SDK 53+ — precisa de development build |

> **Regra crítica (SDK 53+):** Push notifications remotas **não funcionam mais no Expo Go** a partir do SDK 53. Para prototipar, use **notificações locais**. Para produção, use **EAS Build** com `expo-dev-client`.

### 21.2 Instalação

```bash
npx expo install expo-notifications expo-device expo-constants
```

### 21.3 Configuração global — `app/_layout.tsx`

Sempre configurar o handler no topo do app, antes de qualquer tela:

```typescript
import * as Notifications from 'expo-notifications';

// Define o comportamento quando chega notificação com app aberto
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
```

### 21.4 Canal de notificação Android (obrigatório)

Android 8.0+ **descarta notificações silenciosamente** sem canal configurado — sem erro, sem log.

```typescript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

async function configurarCanalAndroid() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('agendamentos', {
      name: 'Agendamentos',
      importance: Notifications.AndroidImportance.HIGH, // aparece como banner
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D63384',
    });
  }
}
```

> Sempre chamar `configurarCanalAndroid()` antes de agendar qualquer notificação no Android.

### 21.5 Notificação local agendada (caso de uso: salão de beleza)

```typescript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Agendar lembrete para 1 hora antes do horário da cliente
async function agendarLembrete(
  nomeCliente: string,
  dataAgendamento: Date
): Promise<string> {

  // Criar canal Android se necessário
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('agendamentos', {
      name: 'Agendamentos',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  // 1 hora antes do agendamento
  const dataLembrete = new Date(dataAgendamento.getTime() - 60 * 60 * 1000);

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Lembrete de Agendamento',
      body: `${nomeCliente} tem horário em 1 hora!`,
      sound: true,
      data: { clienteNome: nomeCliente },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: dataLembrete,
      channelId: 'agendamentos', // obrigatório no Android
    },
  });

  return notificationId; // salvar no Firestore para poder cancelar depois
}

// Cancelar lembrete (ex: quando agendamento for cancelado)
async function cancelarLembrete(notificationId: string) {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

// Cancelar todos os lembretes
async function cancelarTodosLembretes() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
```

### 21.6 Salvar notificationId no Firestore

Sempre salvar o `notificationId` junto com o agendamento para poder cancelar depois:

```typescript
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { app, firestore } from '../utils/firebaseConfig';

async function criarAgendamento(dados: {
  clienteNome: string;
  dataHora: Date;
  servico: string;
  uid: string;
}) {
  const appId = app.options.appId!;

  // 1. Agendar notificação
  const notificationId = await agendarLembrete(dados.clienteNome, dados.dataHora);

  // 2. Salvar agendamento com o notificationId
  await addDoc(
    collection(firestore, 'artifacts', appId, 'users', dados.uid, 'agendamentos'),
    {
      clienteNome: dados.clienteNome,
      dataHora: dados.dataHora,
      servico: dados.servico,
      notificationId,           // ← salvar para cancelar depois
      criadoEm: serverTimestamp(),
    }
  );
}
```

### 21.7 Pedir permissão ao usuário

```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

async function pedirPermissaoNotificacao(): Promise<boolean> {
  // Notificações não funcionam em emuladores
  if (!Device.isDevice) {
    console.warn('Notificações só funcionam em dispositivo físico');
    return false;
  }

  const { status: statusAtual } = await Notifications.getPermissionsAsync();

  if (statusAtual === 'granted') return true;

  // Pedir permissão apenas se ainda não foi decidido
  if (statusAtual === 'undetermined') {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  // Se já foi negado, não perguntar de novo
  return false;
}
```

> Pedir permissão **após** o usuário ter uma ação positiva (ex: ao criar o primeiro agendamento), não na abertura do app.

### 21.8 Hook customizado — `hooks/useNotificacoes.ts`

```typescript
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

export function useNotificacoes() {
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();
  const router = useRouter();

  useEffect(() => {
    // Listener: notificação recebida com app aberto
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notificação recebida:', notification);
      }
    );

    // Listener: usuário tocou na notificação
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        // Navegar para tela de agendamentos ao tocar
        if (data?.clienteNome) {
          router.push('/(tabs)/agendamentos');
        }
      }
    );

    // Cleanup obrigatório
    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
}
```

### 21.9 Listar notificações agendadas (debug)

```typescript
async function listarNotificacoesAgendadas() {
  const notificacoes = await Notifications.getAllScheduledNotificationsAsync();
  console.log('Notificações agendadas:', notificacoes.length);
  notificacoes.forEach(n => {
    console.log('-', n.identifier, n.content.title);
  });
}
```

### 21.10 Push remota para produção (EAS Build)

Para notificações enviadas do servidor (ex: lembrete automático 24h antes):

```bash
# 1. Instalar expo-dev-client
npx expo install expo-dev-client

# 2. Build de desenvolvimento
eas build --profile development --platform android

# 3. Obter token do dispositivo
```

```typescript
import Constants from 'expo-constants';

async function obterExpoPushToken(): Promise<string | null> {
  const permissao = await pedirPermissaoNotificacao();
  if (!permissao) return null;

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  });

  return token.data; // salvar no Firestore em usuarios/{uid}.pushToken
}
```

Enviar do servidor:
```typescript
// No backend (Cloud Function ou servidor Node)
await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: expoPushToken,
    title: 'Lembrete',
    body: 'Você tem um agendamento amanhã!',
    sound: 'default',
    data: { tela: 'agendamentos' },
  }),
});
```

### 21.11 Checklist de notificações

- [ ] `Notifications.setNotificationHandler` no topo do `_layout.tsx`
- [ ] Canal Android criado antes de qualquer notificação (`setNotificationChannelAsync`)
- [ ] Pedir permissão contextualmente — não na abertura do app
- [ ] Salvar `notificationId` no Firestore para cancelar depois
- [ ] Cleanup dos listeners com `return () => listener.remove()`
- [ ] Testar sempre em **dispositivo físico** — emuladores não suportam
- [ ] Para protótipo: notificações **locais** — no Expo Go o LashMatch evita import estático do pacote (§21.12); para testar banner local de verdade, use **development build**
- [ ] Para produção: usar **EAS Build** + push token para notificações remotas
- [ ] `channelId` em todas as notificações Android
- [ ] Não usar push remota no Expo Go SDK 53+ — vai falhar silenciosamente

### 21.12 LashMatch — Expo Go e carregamento de `expo-notifications`

No **Expo Go** (a partir do SDK 53), notificações **push remotas** foram removidas; o próprio pacote `expo-notifications` pode disparar **warning/erro ao ser importado** (side effects como registro de token), mesmo que você só use notificações **locais**.

**Padrão implementado no LashMatch** (`hooks/useLembretesEnviados.ts`):

- Não importar `expo-notifications` estaticamente no topo do arquivo.
- No `useEffect`, se `Constants.appOwnership === 'expo'`, **retornar sem carregar** o módulo (nada de push/listener no Expo Go).
- Fora do Expo Go (dev build / APK): `await import('expo-notifications')` **dinâmico** dentro do efeito; em seguida `setNotificationHandler`, `requestPermissionsAsync`, `scheduleNotificationAsync`, etc.
- Assim o app continua abrindo no Expo Go sem poluir o console; em build de desenvolvimento o fluxo de notificação local ao receber `resumoLembretes/ultimo` funciona.

---

*Última atualização: abril 2026 | Fontes: reactnative.dev/docs · docs.expo.dev/guides/using-firebase · Curso React Native Expo Go — Caio Eduardo · Projeto LashMatch (referência principal) · [Utilizando react-native-calendars na prática](https://dev.to/marcoswillianr/utilizando-react-native-calendars-na-pratica-2egc) · docs.expo.dev/push-notifications/overview*

---

## 22. WHATSAPP — Enviar mensagem via Linking (sem API)

> Fonte: https://brunolagoa.medium.com/enviar-mensagem-para-whatsapp-com-react-native-70239bb65495
> Caso de uso: salão de beleza enviando lembrete de agendamento para cliente via WhatsApp.

### 22.1 Como funciona

Usa o `Linking` nativo do React Native para abrir o WhatsApp com mensagem e número pré-preenchidos. A dona do salão **confirma e toca em enviar** — não é automático. Zero custo, zero API, zero risco de banimento.

### 22.2 Instalação

Nenhuma — `Linking` já vem no React Native. Nada a instalar.

### 22.3 Função utilitária — `utils/whatsapp.ts`

```typescript
import { Linking, Alert } from 'react-native';

// Abre WhatsApp com número e mensagem pré-preenchidos
export async function abrirWhatsApp(
  telefone: string,
  mensagem: string
): Promise<void> {
  // Limpar o telefone — só dígitos + código do país
  const telefoneLimpo = telefone.replace(/\D/g, '');
  // Adicionar 55 (Brasil) se não tiver código do país
  const telefoneComPais = telefoneLimpo.startsWith('55')
    ? telefoneLimpo
    : `55${telefoneLimpo}`;

  const mensagemCodificada = encodeURIComponent(mensagem);

  // Tenta abrir o app do WhatsApp primeiro
  const urlApp = `whatsapp://send?phone=${telefoneComPais}&text=${mensagemCodificada}`;
  // Fallback para WhatsApp Web se app não estiver instalado
  const urlWeb = `https://api.whatsapp.com/send?phone=${telefoneComPais}&text=${mensagemCodificada}`;

  try {
    const suportado = await Linking.canOpenURL(urlApp);
    if (suportado) {
      await Linking.openURL(urlApp);
    } else {
      await Linking.openURL(urlWeb);
    }
  } catch (error) {
    Alert.alert('Erro', 'Não foi possível abrir o WhatsApp.');
  }
}
```

### 22.4 Caso de uso — lembrete de agendamento de salão

```typescript
import { abrirWhatsApp } from '../utils/whatsapp';

// Montar mensagem de lembrete personalizada
function montarMensagemLembrete(
  nomeCliente: string,
  servico: string,
  dataHora: Date
): string {
  const data = dataHora.toLocaleDateString('pt-BR');
  const hora = dataHora.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    `Olá ${nomeCliente}! 💅\n\n` +
    `Lembrando do seu agendamento:\n` +
    `📅 Data: ${data}\n` +
    `⏰ Hora: ${hora}\n` +
    `✂️ Serviço: ${servico}\n\n` +
    `Caso precise reagendar, entre em contato. Te esperamos! 😊`
  );
}

// Usar no componente
async function enviarLembrete(cliente: Cliente, agendamento: Agendamento) {
  if (!cliente.telefone) {
    Alert.alert('Atenção', 'Cliente sem telefone cadastrado.');
    return;
  }

  const mensagem = montarMensagemLembrete(
    cliente.nome,
    agendamento.servico,
    agendamento.dataHora.toDate(), // Timestamp do Firestore → Date
  );

  await abrirWhatsApp(cliente.telefone, mensagem);
}
```

### 22.5 Notificação local para a dona do salão

Quando a dona envia o lembrete, registrar no Firestore e disparar notificação local para ela mesma:

```typescript
import * as Notifications from 'expo-notifications';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { app, firestore } from '../utils/firebaseConfig';

async function registrarEnvioLembrete(
  uid: string,
  agendamentoId: string,
  nomeCliente: string
) {
  const appId = app.options.appId!;

  // 1. Salvar no Firestore que o lembrete foi enviado
  await updateDoc(
    doc(firestore, 'artifacts', appId, 'users', uid, 'agendamentos', agendamentoId),
    {
      lembreteEnviadoEm: serverTimestamp(),
      lembreteEnviado: true,
    }
  );

  // 2. Notificação local para a dona confirmar que foi enviado
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '✅ Lembrete enviado',
      body: `Lembrete de agendamento enviado para ${nomeCliente}`,
      sound: true,
    },
    trigger: null, // dispara imediatamente
  });
}
```

### 22.6 Tela de agendamentos com botão de lembrete

```typescript
import { TouchableOpacity, Text, Alert } from 'react-native';
import tw from 'twrnc';
import { abrirWhatsApp } from '../../utils/whatsapp';
import { registrarEnvioLembrete } from '../../utils/lembretes';

function CardAgendamento({ agendamento, cliente, uid }: Props) {
  async function handleEnviarLembrete() {
    // Confirmar antes de abrir WhatsApp
    Alert.alert(
      'Enviar lembrete',
      `Enviar mensagem para ${cliente.nome}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            const mensagem = montarMensagemLembrete(
              cliente.nome,
              agendamento.servico,
              agendamento.dataHora.toDate(),
            );
            // Abre WhatsApp com mensagem pronta
            await abrirWhatsApp(cliente.telefone, mensagem);
            // Registra no Firestore + notifica a dona
            await registrarEnvioLembrete(uid, agendamento.id, cliente.nome);
          },
        },
      ]
    );
  }

  return (
    <TouchableOpacity
      style={tw`bg-[#1a1a1a] border border-[#333] rounded-2xl p-4 mb-3`}
      onPress={() => {/* abrir detalhe */}}
    >
      <Text style={tw`text-white text-base font-bold`}>{cliente.nome}</Text>
      <Text style={tw`text-gray-400 mt-1`}>{agendamento.servico}</Text>

      {/* Botão WhatsApp */}
      <TouchableOpacity
        style={tw`bg-[#25D366] rounded-xl py-3 mt-3 items-center flex-row justify-center gap-2`}
        onPress={handleEnviarLembrete}
        disabled={agendamento.lembreteEnviado}
      >
        <Text style={tw`text-white font-bold`}>
          {agendamento.lembreteEnviado ? '✅ Lembrete enviado' : '💬 Enviar lembrete WhatsApp'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}
```

### 22.7 Schema Firestore para agendamentos

```
artifacts/{appId}/users/{uid}/agendamentos/{agendamentoId}
  - clienteId:        string       // ref para clientes/{id}
  - clienteNome:      string       // desnormalizado para exibição rápida
  - clienteTelefone:  string       // para abrir WhatsApp direto
  - servico:          string
  - dataHora:         Timestamp
  - lembreteEnviado:  boolean      // false por padrão
  - lembreteEnviadoEm: Timestamp | null
  - notificationId:   string | null // para cancelar lembrete local
  - criadoEm:         Timestamp
```

### 22.8 Checklist de WhatsApp + Agendamento

- [ ] `utils/whatsapp.ts` com `abrirWhatsApp(telefone, mensagem)`
- [ ] Telefone sempre limpo — só dígitos com código `55` do Brasil
- [ ] `canOpenURL` antes de `openURL` — fallback para WhatsApp Web
- [ ] Confirmar com `Alert.alert` antes de abrir WhatsApp
- [ ] Salvar `lembreteEnviado: true` no Firestore após envio
- [ ] Notificação local imediata para a dona confirmar o envio (`trigger: null`)
- [ ] Botão desabilitado visualmente se lembrete já foi enviado
- [ ] Desnormalizar `clienteNome` e `clienteTelefone` no agendamento — evita join extra

---

---

## 23. WHATSAPP AUTOMÁTICO — Z-API + Firebase Cloud Functions

> Fonte: developer.z-api.io · docs.expo.dev/push-notifications
> Caso de uso: salão de beleza enviando lembrete automático 1 dia antes do agendamento, sem a dona precisar fazer nada.

### 23.1 Como funciona o fluxo completo

```
Firebase Scheduler          Cloud Function              Z-API
(todo dia 08:00)    →    busca agendamentos     →    envia WhatsApp
                         de amanhã no Firestore        para cada cliente
                                ↓
                         salva no Firestore             Notificação local
                         lembreteEnviado: true   →    para a dona do salão
```

### 23.2 O que é a Z-API

Serviço brasileiro que conecta seu número de WhatsApp pessoal/business a uma API REST. Você escaneia um QR Code, e a partir daí pode enviar mensagens via HTTP de qualquer servidor.

- Site: **z-api.io**
- Plano gratuito para testar disponível
- Taxa de banimento menor que 0.3% segundo a empresa
- Documentação: **developer.z-api.io**

### 23.3 Setup da Z-API (você faz uma vez)

1. Acesse **app.z-api.io** e crie uma conta
2. Crie uma **instância**
3. Escaneie o QR Code com o WhatsApp do salão
4. Anote: **ID da instância** e **token da instância** (segmentos da URL do endpoint `send-text`).
5. No painel Z-API, em **Segurança**, ative o token de segurança da conta (**Account Security Token**) — valor distinto do token da URL.
6. Adicione como **secrets** do Firebase Functions (pasta `functions/`):

```bash
firebase functions:secrets:set ZAPI_INSTANCE
firebase functions:secrets:set ZAPI_TOKEN
firebase functions:secrets:set ZAPI_CLIENT_TOKEN
```

> `ZAPI_TOKEN` = token que aparece **na URL** após `/token/`. `ZAPI_CLIENT_TOKEN` = token da **conta** usado no header `Client-Token`. Sem o header, a API pode responder `your client-token is not configured`.

### 23.4 Endpoint Z-API para enviar mensagem

```
POST https://api.z-api.io/instances/{INSTANCE_ID}/token/{TOKEN}/send-text

Body:
{
  "phone": "5511999999999",   ← número com código do país (55 = Brasil)
  "message": "Olá Maria! ..."
}
```

### 23.4.1 Header `Client-Token` (obrigatório com segurança da conta ativa)

Quando a validação por token de conta está ativa na Z-API, **toda** requisição `fetch` deve incluir:

```typescript
headers: {
  'Content-Type': 'application/json',
  'Client-Token': zapiClientToken.value(), // secret ZAPI_CLIENT_TOKEN
}
```

No LashMatch isso está centralizado em `zApiHeaders()` em `functions/SRC/index.ts`.

### 23.5 Cloud Function agendada — `functions/SRC/index.ts`

Implementação real: `export const enviarLembretesAgendamento` — `onSchedule` com `schedule: '0 8 * * *'`, `timeZone: 'America/Sao_Paulo'`, `secrets: [zapiInstance, zapiToken, zapiClientToken]`.

**Diferença importante em relação a um pseudo-código “só `GCLOUD_PROJECT`”:** o scheduler atual percorre **todos** os documentos da coleção raiz `artifacts` (cada `id` = namespace, no app costuma ser `app.options.appId`) e, para cada usuária em `usuarios/{uid}`, consulta `artifacts/{namespace}/users/{uid}/agendamentos` com janela de **amanhã** e `lembreteEnviado == false`. Após envios com sucesso para um par `(namespace, uid)`, grava `resumoLembretes/ultimo` nesse mesmo path.

Trecho essencial (secrets + chamada Z-API + tratamento de erro):

```typescript
import { defineSecret } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

const zapiInstance = defineSecret('ZAPI_INSTANCE');
const zapiToken = defineSecret('ZAPI_TOKEN');
const zapiClientToken = defineSecret('ZAPI_CLIENT_TOKEN');

function zApiHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Client-Token': zapiClientToken.value(),
  };
}

// onSchedule({ secrets: [zapiInstance, zapiToken, zapiClientToken], ... }, async () => { ... })

const resposta = await fetch(
  `https://api.z-api.io/instances/${zapiInstance.value()}/token/${zapiToken.value()}/send-text`,
  {
    method: 'POST',
    headers: zApiHeaders(),
    body: JSON.stringify({ phone: telefoneComPais, message: mensagem }),
  }
);

if (!resposta.ok) {
  const detalhe = await resposta.text();
  throw new Error(`Z-API erro ${resposta.status}: ${detalhe}`);
}
```

### 23.6 Schema Firestore para agendamentos

```
artifacts/{appId}/users/{uid}/agendamentos/{agendamentoId}
  - clienteId:          string       // ref para clientes/{id}
  - clienteNome:        string       // desnormalizado — evita join extra
  - clienteTelefone:    string       // formato: "(11) 99999-9999"
  - servico:            string
  - dataHora:           Timestamp    // data e hora do agendamento
  - lembreteEnviado:    boolean      // false por padrão
  - lembreteEnviadoEm:  Timestamp | null
  - criadoEm:           Timestamp    // serverTimestamp()
  - atualizadoEm:       Timestamp    // serverTimestamp() ao editar
```

> **Regra crítica:** sempre desnormalizar `clienteNome` e `clienteTelefone` no documento do agendamento. A Cloud Function não pode fazer joins — precisa dos dados disponíveis diretamente.

### 23.7 Notificação local para a dona quando lembretes são enviados

A Cloud Function grava/atualiza `artifacts/{appId}/users/{uid}/resumoLembretes/ultimo` após envios no ciclo. O app escuta com **`hooks/useLembretesEnviados.ts`** (montado em `app/(tabs)/_layout.tsx`): `onSnapshot` no doc `ultimo`, checagem de `notificado`, `scheduleNotificationAsync` com `trigger: null`, depois `update({ notificado: true })`.

**Não** copie o exemplo antigo com `import * as Notifications from 'expo-notifications'` no topo — no LashMatch o módulo só é carregado fora do Expo Go (ver **§21.12**).

### 23.8 Deploy da Cloud Function

```bash
# Dentro da pasta do projeto
cd functions

# Instalar dependências
npm install

# Build TypeScript (pasta fonte SRC -> lib)
npm run build

# Deploy apenas da função de lembretes
firebase deploy --only functions:enviarLembretesAgendamento

# PowerShell (Windows): ao deployar várias functions, use aspas na lista
firebase deploy --only "functions:testarLembrete,functions:enviarLembretesAgendamento"

# Ver logs em tempo real
firebase functions:log --only enviarLembretesAgendamento
```

> **Atenção:** Cloud Functions com chamadas externas (fetch para Z-API) requerem o plano **Blaze (pay-as-you-go)** do Firebase. Para um salão pequeno com poucos agendamentos por dia, o custo fica em centavos por mês.

### 23.9 Testar manualmente antes do deploy

Função HTTP **`testarLembrete`** em `functions/SRC/index.ts`: body JSON `{ telefone, nome }`, mesmos secrets e `zApiHeaders()` do scheduler. **Valida** `resposta.ok` e devolve corpo da Z-API em sucesso ou erro (nunca `ok: true` cego).

```typescript
export const testarLembrete = onRequest(
  { secrets: [zapiInstance, zapiToken, zapiClientToken] },
  async (req, res) => {
    const { telefone, nome } = req.body || {};
    if (!telefone || !nome) {
      res.status(400).json({ ok: false, error: 'Informe telefone e nome no body.' });
      return;
    }
    const telefoneComPais = `55${String(telefone).replace(/\D/g, '')}`;
    const url = `https://api.z-api.io/instances/${zapiInstance.value()}/token/${zapiToken.value()}/send-text`;
    const resposta = await fetch(url, {
      method: 'POST',
      headers: zApiHeaders(),
      body: JSON.stringify({
        phone: telefoneComPais,
        message: `Teste de lembrete para ${nome} 💅`,
      }),
    });
    const respostaTexto = await resposta.text();
    if (!resposta.ok) {
      res.status(502).json({
        ok: false,
        status: resposta.status,
        error: 'Falha no envio via Z-API.',
        detalhe: respostaTexto,
      });
      return;
    }
    res.json({ ok: true, status: resposta.status, detalhe: respostaTexto });
  }
);
```

### 23.10 Checklist Z-API + Cloud Function

- [ ] Conta criada em **app.z-api.io** e instância conectada
- [ ] Três secrets: `ZAPI_INSTANCE`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN` — e **redeploy** após alterar qualquer um
- [ ] Header `Client-Token` em **todas** as chamadas `fetch` à Z-API (helper `zApiHeaders()`)
- [ ] Plano Firebase Blaze ativado (necessário para chamadas externas)
- [ ] `npm run build` em `functions/` antes do deploy se o código TypeScript compilar para `lib/`
- [ ] `lembreteEnviado: false` ao criar cada agendamento
- [ ] `clienteNome` e `clienteTelefone` desnormalizados no agendamento
- [ ] Telefone sempre com código `55` do Brasil antes de enviar
- [ ] Cloud Function com `timeZone: 'America/Sao_Paulo'`
- [ ] Tratamento de erro individual por agendamento — um erro não para os outros
- [ ] Hook `useLembretesEnviados` no app para notificar a dona (§21.12 — Expo Go sem import estático)
- [ ] `testarLembrete` validando `resposta.ok` + corpo antes de responder sucesso

---

*Última atualização: abril 2026 | Fontes: reactnative.dev/docs · docs.expo.dev/guides/using-firebase · Curso React Native Expo Go — Caio Eduardo · Projeto LashMatch (referência principal) · developer.z-api.io · docs.expo.dev/push-notifications/overview · https://brunolagoa.medium.com/enviar-mensagem-para-whatsapp-com-react-native-70239bb65495*

---

## 24. CONTROLE FINANCEIRO + ESTOQUE — LashMatch

> Caso de uso: dona de salão registra vendas de serviços e produtos, controla custo do estoque consumido e visualiza lucro líquido por período.

### 24.1 Conceitos financeiros do app

| Conceito | Descrição | Exemplo |
|---|---|---|
| **Receita** | Valor cobrado da cliente | R$ 150 por extensão de cílios |
| **Custo do produto** | Valor pago pelo produto consumido | R$ 30 em cílios usados |
| **Lucro bruto** | Receita − Custo do produto | R$ 120 |
| **Despesa** | Gasto fixo ou variável (aluguel, luz) | R$ 500/mês |
| **Lucro líquido** | Lucro bruto − Despesas | R$ 120 − parcela de R$ 500 |

### 24.2 Schema Firestore — módulo financeiro

```
// Vendas (cada atendimento registrado)
artifacts/{appId}/users/{uid}/vendas/{vendaId}
  - clienteNome:      string          // desnormalizado
  - clienteId:        string | null   // ref para clientes/{id}
  - servico:          string          // ex: "Extensão volume russo"
  - valorVenda:       number          // R$ cobrado da cliente
  - produtosUsados:   ProdutoUsado[]  // lista de produtos do estoque
  - custoTotal:       number          // soma dos custos dos produtos
  - lucroBruto:       number          // valorVenda - custoTotal
  - formaPagamento:   'pix' | 'dinheiro' | 'cartao_credito' | 'cartao_debito'
  - dataVenda:        Timestamp       // serverTimestamp()
  - observacao:       string | null

// Tipo ProdutoUsado (dentro da venda)
interface ProdutoUsado {
  produtoId:    string   // id do produto no estoque
  produtoNome:  string   // desnormalizado
  quantidade:   number   // quantas unidades foram usadas
  custoUnitario: number  // custo por unidade no momento da venda
  custoTotal:   number   // quantidade * custoUnitario
}

// Despesas fixas e variáveis
artifacts/{appId}/users/{uid}/despesas/{despesaId}
  - descricao:    string
  - valor:        number
  - categoria:    'aluguel' | 'produto' | 'marketing' | 'equipamento' | 'outros'
  - tipo:         'fixa' | 'variavel'
  - data:         Timestamp
  - criadoEm:     Timestamp

// Produtos do estoque — já existente — adicionar campo custoUnitario
artifacts/{appId}/users/{uid}/estoque/{produtoId}
  - ...campos já existentes...
  - custoUnitario: number   // ← NOVO: custo de compra por unidade
```

### 24.3 Integração venda + estoque

Ao registrar uma venda, **sempre** baixar o estoque automaticamente:

```typescript
import {
  addDoc, collection, doc, runTransaction,
  serverTimestamp, Timestamp
} from 'firebase/firestore';
import { app, firestore } from '../utils/firebaseConfig';

interface ProdutoUsado {
  produtoId:     string;
  produtoNome:   string;
  quantidade:    number;
  custoUnitario: number;
  custoTotal:    number;
}

interface NovaVenda {
  clienteNome:    string;
  clienteId?:     string;
  servico:        string;
  valorVenda:     number;
  produtosUsados: ProdutoUsado[];
  formaPagamento: 'pix' | 'dinheiro' | 'cartao_credito' | 'cartao_debito';
  observacao?:    string;
}

async function registrarVenda(uid: string, dados: NovaVenda): Promise<void> {
  const appId = app.options.appId!;
  const basePath = `artifacts/${appId}/users/${uid}`;

  const custoTotal = dados.produtosUsados.reduce(
    (acc, p) => acc + p.custoTotal, 0
  );
  const lucroBruto = dados.valorVenda - custoTotal;

  // runTransaction garante que venda + baixa de estoque são atômicos
  // se um falhar, nenhum é salvo
  await runTransaction(firestore, async (transaction) => {

    // 1. Verificar estoque suficiente antes de qualquer escrita
    for (const produto of dados.produtosUsados) {
      const estoqueRef = doc(
        firestore, basePath, 'estoque', produto.produtoId
      );
      const estoqueSnap = await transaction.get(estoqueRef);

      if (!estoqueSnap.exists()) {
        throw new Error(`Produto ${produto.produtoNome} não encontrado.`);
      }

      const qtdAtual = estoqueSnap.data().quantidade as number;
      if (qtdAtual < produto.quantidade) {
        throw new Error(
          `Estoque insuficiente para ${produto.produtoNome}. ` +
          `Disponível: ${qtdAtual}, necessário: ${produto.quantidade}`
        );
      }
    }

    // 2. Criar a venda
    const vendaRef = doc(collection(firestore, basePath, 'vendas'));
    transaction.set(vendaRef, {
      ...dados,
      custoTotal,
      lucroBruto,
      dataVenda: serverTimestamp(),
    });

    // 3. Baixar estoque de cada produto usado
    for (const produto of dados.produtosUsados) {
      const estoqueRef = doc(
        firestore, basePath, 'estoque', produto.produtoId
      );
      const estoqueSnap = await transaction.get(estoqueRef);
      const qtdAtual = estoqueSnap.data()!.quantidade as number;

      transaction.update(estoqueRef, {
        quantidade: qtdAtual - produto.quantidade,
        atualizadoEm: serverTimestamp(),
      });
    }
  });
}
```

> **Por que `runTransaction`?** Se a venda for salva mas o estoque falhar (ou vice-versa), os dados ficam inconsistentes. A transaction garante que os dois acontecem juntos ou nenhum acontece.

### 24.4 Cálculo de relatório por período

```typescript
import {
  collection, query, where, getDocs,
  Timestamp, orderBy
} from 'firebase/firestore';
import { app, firestore } from '../utils/firebaseConfig';

interface RelatorioFinanceiro {
  totalReceita:    number;
  totalCustos:     number;
  totalLucroBruto: number;
  totalDespesas:   number;
  lucroLiquido:    number;
  qtdVendas:       number;
  ticketMedio:     number;
  porFormaPagamento: Record<string, number>;
}

async function calcularRelatorio(
  uid: string,
  inicio: Date,
  fim: Date
): Promise<RelatorioFinanceiro> {
  const appId = app.options.appId!;
  const basePath = `artifacts/${appId}/users/${uid}`;

  // Buscar vendas do período
  const vendasSnap = await getDocs(query(
    collection(firestore, basePath, 'vendas'),
    where('dataVenda', '>=', Timestamp.fromDate(inicio)),
    where('dataVenda', '<=', Timestamp.fromDate(fim)),
    orderBy('dataVenda', 'desc')
  ));

  // Buscar despesas do período
  const despesasSnap = await getDocs(query(
    collection(firestore, basePath, 'despesas'),
    where('data', '>=', Timestamp.fromDate(inicio)),
    where('data', '<=', Timestamp.fromDate(fim))
  ));

  let totalReceita    = 0;
  let totalCustos     = 0;
  let totalLucroBruto = 0;
  const porFormaPagamento: Record<string, number> = {};

  vendasSnap.docs.forEach(d => {
    const v = d.data();
    totalReceita    += v.valorVenda   || 0;
    totalCustos     += v.custoTotal   || 0;
    totalLucroBruto += v.lucroBruto   || 0;

    const forma = v.formaPagamento || 'outros';
    porFormaPagamento[forma] = (porFormaPagamento[forma] || 0) + v.valorVenda;
  });

  const totalDespesas = despesasSnap.docs.reduce(
    (acc, d) => acc + (d.data().valor || 0), 0
  );

  const qtdVendas  = vendasSnap.size;
  const lucroLiquido = totalLucroBruto - totalDespesas;
  const ticketMedio  = qtdVendas > 0
    ? totalReceita / qtdVendas
    : 0;

  return {
    totalReceita,
    totalCustos,
    totalLucroBruto,
    totalDespesas,
    lucroLiquido,
    qtdVendas,
    ticketMedio,
    porFormaPagamento,
  };
}
```

### 24.5 Padrões de UI do módulo financeiro

Seguir a mesma identidade visual do estoque já existente:

```typescript
// Cores para valores financeiros — padrão LashMatch
const FINANCIAL_COLORS = {
  receita:   '#4ade80',   // verde — entradas
  custo:     '#f87171',   // vermelho — saídas/custos
  lucro:     '#D63384',   // rosa primário — lucro
  neutro:    '#9e9e9e',   // cinza — valores neutros
  pix:       '#00B4D8',   // azul claro — Pix
  dinheiro:  '#4ade80',   // verde — dinheiro
  cartao:    '#a78bfa',   // roxo — cartão
};

// Card de resumo financeiro
function CardFinanceiro({
  label, valor, cor, prefixo = 'R$'
}: {
  label: string;
  valor: number;
  cor: string;
  prefixo?: string;
}) {
  return (
    <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: cor }]}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardValor, { color: cor }]}>
        {prefixo} {valor.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </Text>
    </View>
  );
}
```

### 24.6 Tela de Nova Venda — estrutura

```typescript
// app/(tabs)/financeiro/nova-venda.tsx
// Campos do formulário:
// 1. Cliente (busca na lista de clientes)
// 2. Serviço (texto livre ou seleção de lista)
// 3. Valor da venda (R$)
// 4. Forma de pagamento (chips: Pix, Dinheiro, Cartão crédito, Cartão débito)
// 5. Produtos usados (seleção do estoque com quantidade e custo unitário)
// 6. Observação (opcional)
// 7. Preview automático: Custo total / Lucro bruto
// 8. Botão Salvar → runTransaction(venda + baixa estoque)
```

### 24.7 Tela de Relatório — estrutura

```typescript
// app/(tabs)/financeiro/relatorio.tsx
// Filtros de período: Hoje / Esta semana / Este mês / Personalizado
// Cards de resumo:
//   - Total de receita (verde)
//   - Total de custos de produtos (vermelho)
//   - Lucro bruto (rosa)
//   - Total de despesas (vermelho)
//   - Lucro líquido (rosa — destaque maior)
//   - Ticket médio (cinza)
//   - Quantidade de vendas (cinza)
// Gráfico de formas de pagamento (barras simples com View proporcional)
// Lista de vendas do período (FlatList)
```

### 24.8 Adicionar campo custoUnitario no estoque existente

O estoque já existe — só precisa adicionar o campo `custoUnitario` ao modal de edição:

```typescript
// No modal de produto (estoque.tsx já existente)
// Adicionar campo:
<Text style={styles.label}>Custo unitário (R$)</Text>
<TextInput
  value={custoUnitario}
  onChangeText={setCustoUnitario}
  keyboardType="decimal-pad"
  placeholder="0,00"
  placeholderTextColor={COLORS.textMuted}
  style={styles.input}
/>

// Ao salvar, incluir custoUnitario no updateDoc/addDoc:
custoUnitario: parseFloat(custoUnitario.replace(',', '.')) || 0,
```

### 24.9 Índices Firestore necessários

```
// Criar no Firebase Console → Firestore → Índices
vendas: dataVenda (ASC) + uid implícito no path ← automático
vendas: dataVenda + formaPagamento             ← criar se precisar filtrar
despesas: data (ASC)                           ← automático
```

### 24.10 Checklist do módulo financeiro

- [ ] Campo `custoUnitario` adicionado ao schema do estoque
- [ ] Schema de `vendas` e `despesas` criado no Firestore
- [ ] `runTransaction` para venda + baixa de estoque — nunca separados
- [ ] Verificar estoque suficiente ANTES de salvar a venda
- [ ] Calcular `custoTotal` e `lucroBruto` no momento do registro
- [ ] Desnormalizar `clienteNome` e `produtoNome` nas vendas
- [ ] Relatório busca vendas E despesas do período
- [ ] `lucroLiquido = lucroBruto - despesas` (não receita - despesas)
- [ ] Valores formatados com `toLocaleString('pt-BR')` — nunca `toFixed(2)` sem formatação
- [ ] Cores financeiras: verde=receita, vermelho=custo, rosa=lucro
- [ ] `ticketMedio` só calculado se `qtdVendas > 0` — evitar divisão por zero

---

*Última atualização: abril 2026 | Fontes: reactnative.dev/docs · docs.expo.dev/guides/using-firebase · Curso React Native Expo Go — Caio Eduardo · Projeto LashMatch (referência principal) · developer.z-api.io · docs.expo.dev/push-notifications/overview*

---

## 25. SISTEMA DE AGENDAMENTO COMPLETO — LashMatch

> Caso de uso: salão de cílios com múltiplas funcionárias, serviços com durações variadas, agendamento pela dona no app E pela cliente via link público. Confirmação e lembrete automáticos via Z-API.

### 25.1 Visão geral da arquitetura

```
DONA DO SALÃO (app React Native)
  ├── Cadastra funcionárias
  ├── Cadastra serviços + duração + preço
  ├── Agenda manualmente pelo app
  └── Vê agenda do dia por funcionária

CLIENTE (link público — Firebase Hosting)
  ├── Acessa: seuapp.web.app/agendar
  ├── Escolhe serviço → vê duração e preço
  ├── Escolhe funcionária
  ├── Vê apenas horários DISPONÍVEIS
  ├── Informa nome + WhatsApp
  └── Confirma → Z-API envia confirmação automática

CLOUD FUNCTIONS (automático)
  ├── enviarConfirmacaoAgendamento → dispara ao criar agendamento
  └── enviarLembretesAgendamento  → todo dia 08:00, 24h antes
```

### 25.2 Schema Firestore completo

```
// Funcionárias do salão
artifacts/{appId}/users/{uid}/funcionarias/{funcId}
  - nome:          string
  - especialidade: string         // ex: "Volume russo, Clássico"
  - ativa:         boolean
  - criadoEm:      Timestamp

// Serviços oferecidos
artifacts/{appId}/users/{uid}/servicos/{servicoId}
  - nome:           string        // ex: "Volume russo - 1ª vez"
  - duracaoMinutos: number        // ex: 180 (3h), 90 (1h30), 150 (2h30)
  - preco:          number        // ex: 150.00
  - ativo:          boolean
  - criadoEm:       Timestamp

// Agendamentos (dona + cliente pública)
artifacts/{appId}/users/{uid}/agendamentos/{agendId}
  - clienteNome:       string
  - clienteTelefone:   string     // formato: "5511999999999" (com 55)
  - clienteId?:        string     // se cliente cadastrada no app
  - funcionariaId:     string     // ref para funcionarias/{id}
  - funcionariaNome:   string     // desnormalizado
  - servicoId:         string     // ref para servicos/{id}
  - servicoNome:       string     // desnormalizado
  - duracaoMinutos:    number     // copiado do serviço no momento
  - preco:             number     // copiado do serviço no momento
  - dataHoraInicio:    Timestamp
  - dataHoraFim:       Timestamp  // dataHoraInicio + duracaoMinutos
  - origem:            'app' | 'link_publico'
  - status:            'confirmado' | 'cancelado' | 'concluido'
  - lembreteEnviado:   boolean
  - lembreteEnviadoEm: Timestamp | null
  - criadoEm:          Timestamp
```

> **Regra crítica:** sempre salvar `dataHoraFim = dataHoraInicio + duracaoMinutos`. Sem isso a verificação de conflito não funciona.

### 25.3 Lógica de verificação de conflito

```typescript
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { app, firestore } from '../utils/firebaseConfig';

/**
 * Conflito ocorre quando os intervalos se sobrepõem:
 * novoInício < existenteFim  E  novoFim > existenteInício
 */
async function verificarDisponibilidade(
  uid: string,
  funcionariaId: string,
  inicio: Date,
  duracaoMinutos: number,
  agendamentoExcluidoId?: string  // para edição — ignorar o próprio
): Promise<{ disponivel: boolean; conflito?: string }> {

  const fim = new Date(inicio.getTime() + duracaoMinutos * 60 * 1000);
  const appId = app.options.appId!;

  const ref = collection(
    firestore, 'artifacts', appId, 'users', uid, 'agendamentos'
  );

  const snap = await getDocs(query(
    ref,
    where('funcionariaId', '==', funcionariaId),
    where('status', '!=', 'cancelado'),
    where('dataHoraFim', '>', Timestamp.fromDate(inicio)),
  ));

  for (const docSnap of snap.docs) {
    if (docSnap.id === agendamentoExcluidoId) continue;

    const ag = docSnap.data();
    const existenteInicio = ag.dataHoraInicio.toDate();

    if (inicio < ag.dataHoraFim.toDate() && fim > existenteInicio) {
      return {
        disponivel: false,
        conflito: `${ag.clienteNome} já tem horário das ` +
          `${existenteInicio.toLocaleTimeString('pt-BR', {
            hour: '2-digit', minute: '2-digit'
          })}`,
      };
    }
  }

  return { disponivel: true };
}
```

### 25.4 Gerar slots de horário disponíveis (página pública)

```typescript
const HORARIO_ABERTURA   = 8;   // 08:00
const HORARIO_FECHAMENTO = 19;  // 19:00
const INTERVALO_SLOT     = 30;  // slots de 30 em 30 minutos

async function gerarSlotsDisponiveis(
  uid: string,
  funcionariaId: string,
  data: Date,
  duracaoMinutos: number
): Promise<Date[]> {

  const appId = app.options.appId!;
  const inicioDia = new Date(data); inicioDia.setHours(0, 0, 0, 0);
  const fimDia    = new Date(data); fimDia.setHours(23, 59, 59, 999);

  const ref = collection(
    firestore, 'artifacts', appId, 'users', uid, 'agendamentos'
  );
  const snap = await getDocs(query(
    ref,
    where('funcionariaId', '==', funcionariaId),
    where('status', '!=', 'cancelado'),
    where('dataHoraInicio', '>=', Timestamp.fromDate(inicioDia)),
    where('dataHoraInicio', '<=', Timestamp.fromDate(fimDia)),
  ));

  const existentes = snap.docs.map(d => ({
    inicio: d.data().dataHoraInicio.toDate(),
    fim:    d.data().dataHoraFim.toDate(),
  }));

  const slots: Date[] = [];
  let slotAtual = new Date(data);
  slotAtual.setHours(HORARIO_ABERTURA, 0, 0, 0);

  const fimPossivel = new Date(data);
  fimPossivel.setHours(HORARIO_FECHAMENTO, 0, 0, 0);

  while (slotAtual < fimPossivel) {
    const slotFim = new Date(slotAtual.getTime() + duracaoMinutos * 60 * 1000);

    if (slotFim <= fimPossivel) {
      const temConflito = existentes.some(ag =>
        slotAtual < ag.fim && slotFim > ag.inicio
      );
      if (!temConflito) slots.push(new Date(slotAtual));
    }

    slotAtual = new Date(slotAtual.getTime() + INTERVALO_SLOT * 60 * 1000);
  }

  return slots;
}
```

### 25.5 Estrutura de arquivos do sistema

```
app/
├── (tabs)/
│   ├── agendamentos.tsx      ← REFATORAR — adicionar funcionária + serviço
│   ├── funcionarias.tsx      ← NOVO — cadastro de funcionárias
│   └── servicos.tsx          ← NOVO — cadastro de serviços com duração
│
└── agendar/
    └── index.tsx             ← NOVO — página pública sem login

functions/SRC/index.ts        ← adicionar enviarConfirmacaoAgendamento
```

### 25.6 Refatoração obrigatória do agendamentos.tsx

```typescript
// ADICIONAR ao formulário existente:

// 1. Buscar e selecionar FUNCIONÁRIA (igual ao padrão de busca de clientes)

// 2. Buscar e selecionar SERVIÇO (chips de seleção)
// Ao selecionar: mostrar duração e preço

// 3. Calcular dataHoraFim automaticamente
const dataHoraFim = new Date(
  dataHoraInicio.getTime() + servicoSelecionado.duracaoMinutos * 60 * 1000
);

// 4. Verificar conflito ANTES de salvar
const { disponivel, conflito } = await verificarDisponibilidade(
  uid, funcionariaId, dataHoraInicio, servicoSelecionado.duracaoMinutos
);
if (!disponivel) {
  Alert.alert('Horário indisponível', conflito);
  return;
}

// 5. Salvar com novos campos obrigatórios
await addDoc(ref, {
  ...payloadBase,
  funcionariaId,
  funcionariaNome,        // desnormalizado
  servicoId,
  servicoNome,            // desnormalizado
  duracaoMinutos: servicoSelecionado.duracaoMinutos,
  preco: servicoSelecionado.preco,
  dataHoraInicio: Timestamp.fromDate(dataHoraInicio),
  dataHoraFim:    Timestamp.fromDate(dataHoraFim),   // OBRIGATÓRIO
  origem: 'app',
  status: 'confirmado',
});
```

### 25.7 Cloud Function — confirmação automática ao criar agendamento

```typescript
// functions/SRC/index.ts — adicionar junto às funções existentes
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

export const enviarConfirmacaoAgendamento = onDocumentCreated(
  {
    document: 'artifacts/{appId}/users/{uid}/agendamentos/{agendId}',
    secrets: [zapiInstance, zapiToken, zapiClientToken],
  },
  async (event) => {
    const ag = event.data?.data();
    if (!ag || !ag.clienteTelefone) return;

    const dataHora = ag.dataHoraInicio.toDate();
    const data = dataHora.toLocaleDateString('pt-BR');
    const hora = dataHora.toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit'
    });

    const mensagem =
      `Olá ${ag.clienteNome}! 💅\n\n` +
      `Seu agendamento foi *confirmado*:\n` +
      `📅 Data: *${data}*\n` +
      `⏰ Hora: *${hora}*\n` +
      `✂️ Serviço: *${ag.servicoNome}*\n` +
      `👩 Profissional: *${ag.funcionariaNome}*\n\n` +
      `Te esperamos! 😊`;

    const telefone = ag.clienteTelefone.replace(/\D/g, '');
    const telefoneComPais = telefone.startsWith('55')
      ? telefone : `55${telefone}`;

    const resposta = await fetch(
      `https://api.z-api.io/instances/${zapiInstance.value()}/token/${zapiToken.value()}/send-text`,
      {
        method: 'POST',
        headers: zApiHeaders(),  // inclui Client-Token (ver Seção 23.4.1)
        body: JSON.stringify({ phone: telefoneComPais, message: mensagem }),
      }
    );

    if (!resposta.ok) {
      const detalhe = await resposta.text();
      throw new Error(`Z-API confirmação erro ${resposta.status}: ${detalhe}`);
    }

    await event.data?.ref.update({
      confirmacaoEnviadaEm: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);
```

### 25.8 Página pública — fluxo da cliente

```typescript
// app/agendar/index.tsx — sem login, acessível via Firebase Hosting
// Passo 1: cliente escolhe o serviço → vê duração e preço
// Passo 2: cliente escolhe a funcionária
// Passo 3: cliente escolhe a data (calendário, mínimo hoje)
// Passo 4: app mostra slots disponíveis (gerarSlotsDisponiveis)
// Passo 5: cliente seleciona o horário
// Passo 6: cliente informa nome + WhatsApp
// Passo 7: confirmar → addDoc com origem: 'link_publico'
// Passo 8: Cloud Function dispara confirmação automática via Z-API

// UID do salão: passar via parâmetro de URL
// Ex: seuapp.web.app/agendar?uid=abc123
```

### 25.9 Regras Firestore para página pública

```javascript
// firestore.rules — adicionar para permitir agendamento sem login
match /artifacts/{appId}/users/{uid}/servicos/{id} {
  allow read: if true;  // público — cliente precisa ver os serviços
}
match /artifacts/{appId}/users/{uid}/funcionarias/{id} {
  allow read: if true;  // público — cliente precisa ver as funcionárias
}
match /artifacts/{appId}/users/{uid}/agendamentos/{id} {
  allow read:   if request.auth.uid == uid;
  allow create: if true;  // cliente cria sem autenticação
  allow update, delete: if request.auth.uid == uid;
}
```

### 25.10 Agrupamento por funcionária na tela da dona

```typescript
// Visualização da agenda do dia agrupada por funcionária
const agendamentosPorFuncionaria = useMemo(() => {
  const grupos: Record<string, Agendamento[]> = {};
  agendamentosFiltrados.forEach(ag => {
    if (!grupos[ag.funcionariaId]) grupos[ag.funcionariaId] = [];
    grupos[ag.funcionariaId].push(ag);
  });
  return grupos;
}, [agendamentosFiltrados]);
```

### 25.11 Checklist do sistema de agendamento completo

**Parte 1 — Cadastros base (fazer primeiro):**
- [ ] `funcionarias.tsx` — CRUD completo com ativa/inativa
- [ ] `servicos.tsx` — CRUD com `duracaoMinutos` e `preco`
- [ ] Ambas as abas adicionadas no `_layout.tsx`

**Parte 2 — Refatorar agendamentos:**
- [ ] Seleção de funcionária no formulário
- [ ] Seleção de serviço com exibição de duração e preço
- [ ] `dataHoraFim` calculado e salvo obrigatoriamente
- [ ] `verificarDisponibilidade` chamado antes de salvar
- [ ] Campos `funcionariaNome` e `servicoNome` desnormalizados
- [ ] `status: 'confirmado'` e `origem: 'app'` ao criar

**Parte 3 — Página pública:**
- [ ] `app/agendar/index.tsx` sem login
- [ ] `gerarSlotsDisponiveis` — só mostrar horários livres
- [ ] `origem: 'link_publico'` ao salvar
- [ ] Regras Firestore permitindo leitura pública e criação sem auth
- [ ] `enviarConfirmacaoAgendamento` — Cloud Function onDocumentCreated
- [ ] Deploy: `firebase deploy --only functions:enviarConfirmacaoAgendamento`

**Regras gerais:**
- [ ] Ignorar `status: 'cancelado'` em todas as queries de conflito
- [ ] Ao editar, passar `agendamentoExcluidoId` para não conflitar consigo mesmo
- [ ] Integrar `preco` com módulo financeiro (Seção 24) ao marcar como `'concluido'`

---

*Última atualização: abril 2026 | Fontes: reactnative.dev/docs · docs.expo.dev/guides/using-firebase · Curso React Native Expo Go — Caio Eduardo · Projeto LashMatch (referência principal) · developer.z-api.io · docs.expo.dev/push-notifications/overview*

---

## 26. MERCADO PAGO — Checkout Pro com Expo + Firebase Functions

> Fonte: mercadopago.com.br/developers/pt/docs · docs.expo.dev
> Caso de uso: salão de beleza cobrando clientes pelo app (serviços, assinaturas de plano, etc.)

### 26.1 Como funciona o fluxo completo

```
APP (React Native)          Cloud Function              Mercado Pago
       ↓                          ↓                          ↓
Usuário toca "Pagar"   →   cria preferência de    →   retorna init_point
                            pagamento via API           (URL do checkout)
       ↓                                                     ↓
openBrowserAsync(url)  ←────────────────────────   usuário paga no browser
       ↓
Deep Link retorna ao app
       ↓
Webhook confirma pagamento no backend
       ↓
Firestore atualizado com status do pagamento
```

> **Regra de segurança crítica:** o ACCESS_TOKEN do Mercado Pago NUNCA vai no app. Fica apenas no backend (Cloud Function). O app só recebe o init_point (URL) para abrir o browser.

### 26.2 Credenciais necessárias

| Credencial | Onde usar | Como obter |
|---|---|---|
| PUBLIC_KEY | Frontend — identificar a conta | Painel MP → Credenciais |
| ACCESS_TOKEN | Backend — criar preferências | Painel MP → Credenciais |

```bash
# Salvar como secrets do Firebase (NUNCA no .env do app)
firebase functions:secrets:set MP_ACCESS_TOKEN
firebase functions:secrets:set MP_PUBLIC_KEY
```

Painel de desenvolvedores: mercadopago.com.br/developers/panel

> Usar credenciais de Sandbox para testes e Produção para cobranças reais.

### 26.3 Instalação no app Expo

```bash
# Único pacote necessário no app
npx expo install expo-web-browser

# Para Deep Links (retorno ao app após pagamento)
npx expo install expo-linking
```

Nenhuma outra dependência de Mercado Pago no app — toda a lógica fica no backend.

### 26.4 Cloud Function — criar preferência de pagamento

```typescript
// functions/SRC/index.ts
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';

const mpAccessToken = defineSecret('MP_ACCESS_TOKEN');

export const criarPreferenciaPagamento = onRequest(
  { secrets: [mpAccessToken], cors: true },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método não permitido' });
      return;
    }

    const { titulo, valor, quantidade = 1, uid, referencia } = req.body;

    if (!titulo || !valor || !uid) {
      res.status(400).json({ error: 'titulo, valor e uid são obrigatórios' });
      return;
    }

    try {
      const resposta = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mpAccessToken.value()}`,
        },
        body: JSON.stringify({
          items: [{
            title: titulo,
            quantity: quantidade,
            currency_id: 'BRL',
            unit_price: Number(valor),
          }],
          back_urls: {
            success: 'lashmatch://pagamento/sucesso',
            failure: 'lashmatch://pagamento/falha',
            pending: 'lashmatch://pagamento/pendente',
          },
          auto_return: 'approved',
          external_reference: referencia || uid,
          notification_url: 'https://SUA_REGION-SEU_PROJETO.cloudfunctions.net/webhookMercadoPago',
        }),
      });

      if (!resposta.ok) {
        const erro = await resposta.text();
        res.status(502).json({ error: 'Falha ao criar preferência', detalhe: erro });
        return;
      }

      const dados = await resposta.json();

      // Salvar no Firestore para rastreamento
      const appId = process.env.GCLOUD_PROJECT || '';
      await admin.firestore()
        .collection('artifacts').doc(appId)
        .collection('users').doc(uid)
        .collection('pagamentos').add({
          preferenceId: dados.id,
          titulo,
          valor: Number(valor),
          status: 'pendente',
          criadoEm: admin.firestore.FieldValue.serverTimestamp(),
          external_reference: referencia || uid,
        });

      res.json({
        preferenceId: dados.id,
        initPoint: dados.init_point,
        sandboxInitPoint: dados.sandbox_init_point,
      });

    } catch (erro) {
      console.error('Erro ao criar preferência:', erro);
      res.status(500).json({ error: 'Erro interno' });
    }
  }
);
```

### 26.5 Cloud Function — webhook de confirmação

```typescript
export const webhookMercadoPago = onRequest(
  { secrets: [mpAccessToken] },
  async (req, res) => {
    res.status(200).send('OK'); // Responder imediatamente

    const { type, data } = req.body;
    if (type !== 'payment') return;

    try {
      const pagamentoResp = await fetch(
        `https://api.mercadopago.com/v1/payments/${data.id}`,
        { headers: { 'Authorization': `Bearer ${mpAccessToken.value()}` } }
      );

      const pagamento = await pagamentoResp.json();
      const { status, external_reference } = pagamento;

      const appId = process.env.GCLOUD_PROJECT || '';
      const snap = await admin.firestore()
        .collection('artifacts').doc(appId)
        .collection('users').doc(external_reference)
        .collection('pagamentos')
        .where('external_reference', '==', external_reference)
        .orderBy('criadoEm', 'desc')
        .limit(1)
        .get();

      if (!snap.empty) {
        await snap.docs[0].ref.update({
          status,
          paymentId: data.id,
          atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (erro) {
      console.error('Erro webhook:', erro);
    }
  }
);
```

### 26.6 No app — iniciar pagamento

```typescript
// utils/mercadoPago.ts
import { openBrowserAsync } from 'expo-web-browser';
import { auth } from './firebaseConfig';

const FUNCAO_URL = process.env.EXPO_PUBLIC_MP_FUNCTION_URL!;

export async function iniciarPagamento(dados: {
  titulo: string;
  valor: number;
  referencia?: string;
}): Promise<'cancelado' | 'pendente'> {

  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Usuário não autenticado');

  const resp = await fetch(FUNCAO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...dados, uid }),
  });

  if (!resp.ok) throw new Error('Falha ao criar preferência');

  const { sandboxInitPoint, initPoint } = await resp.json();
  const url = __DEV__ ? sandboxInitPoint : initPoint;

  const resultado = await openBrowserAsync(url);
  return resultado.type === 'cancel' ? 'cancelado' : 'pendente';
}
```

### 26.7 Configurar Deep Link no app.json

```json
{
  "expo": {
    "scheme": "lashmatch",
    "android": {
      "intentFilters": [{
        "action": "VIEW",
        "data": [{ "scheme": "lashmatch", "host": "pagamento" }],
        "category": ["BROWSABLE", "DEFAULT"]
      }]
    }
  }
}
```

### 26.8 Schema Firestore para pagamentos

```
artifacts/{appId}/users/{uid}/pagamentos/{id}
  - preferenceId:       string     // ID da preferência no MP
  - paymentId:          string     // ID do pagamento (vem do webhook)
  - titulo:             string
  - valor:              number
  - status:             'pendente' | 'approved' | 'rejected' | 'cancelled'
  - external_reference: string     // uid do usuário
  - criadoEm:           Timestamp
  - atualizadoEm:       Timestamp
```

### 26.9 Ambiente de testes (Sandbox)

```
1. mercadopago.com.br/developers/panel/test-users → criar usuários de teste
2. Usar credenciais do usuário VENDEDOR no ACCESS_TOKEN
3. Usar credenciais do usuário COMPRADOR para simular pagamentos

Cartão de teste aprovado (Brasil):
  Número:   5031 4332 1540 6351
  CVV:      123
  Validade: 11/25
  Nome:     APRO
```

### 26.10 Checklist Mercado Pago

- [ ] `MP_ACCESS_TOKEN` salvo como secret Firebase — nunca no `.env` do app
- [ ] Cloud Function `criarPreferenciaPagamento` deployada
- [ ] Cloud Function `webhookMercadoPago` deployada com URL na preferência
- [ ] `expo-web-browser` instalado no app
- [ ] `scheme: "lashmatch"` no `app.json`
- [ ] `intentFilters` Android configurado para Deep Link
- [ ] `back_urls` apontando para `lashmatch://pagamento/...`
- [ ] `external_reference` com `uid` para conciliação no Firestore
- [ ] Schema `pagamentos` no Firestore
- [ ] `sandboxInitPoint` em `__DEV__`, `initPoint` em produção
- [ ] Webhook responde `200` imediatamente antes de processar

---

## 27. MERCADO PAGO — Assinatura (preapproval), planos e webhooks

### 27.1 Cloud Functions (LashMatch)

| Função | Descrição |
|--------|-----------|
| `criarAssinatura` | Mesmo fluxo de `criarAssinaturaMercadoPago`: Bearer Firebase + `card_token_id` + `plano`; cria preapproval no MP e atualiza `usuarios/{uid}.plano`. |
| `criarAssinaturaMercadoPago` | Handler compartilhado com `criarAssinatura` (código único). |
| `criarPlanoMP` | POST administrativo: cria `preapproval_plan` na API MP e grava `config/mercadopago_planos` (chaves `mensal` / `anual`). Body: `{ planoId, setupKey }` com `setupKey` igual a `process.env.MP_PLANO_SETUP_KEY` (ex.: `functions/.env` ou variável no runtime Cloud Functions). |
| `webhookAssinatura` | URL dedicada a notificações de assinatura; responde `200` e sincroniza `usuarios/{uid}.plano` via GET `/preapproval/{id}`. Ignora `topic=payment` (checkout usa `webhookMercadoPago`). |

Se existir `mp_plan_id` em `config/mercadopago_planos` para o plano escolhido, `criarAssinatura*` usa `preapproval_plan_id` em vez de `auto_recurring` inline. O preapproval envia `notification_url` para `webhookAssinatura` quando `GCLOUD_PROJECT` está definido.

### 27.2 Credenciais

- `MERCADOPAGO_ACCESS_TOKEN` (secret) — assinaturas e planos.
- `MP_PLANO_SETUP_KEY` (variável de ambiente, não secret) — chave esperada no body `setupKey` de `criarPlanoMP`. Sem valor, a função responde 503.

### 27.3 Firestore

- `usuarios/{uid}.plano` — ver `PROJECT.md` (inclui `mp_preapproval_plan_id`, `ultimaSincronizacaoWebhook` quando aplicável).
- `config/mercadopago_planos` — ids de plano MP por período (`mensal` / `anual`).

### 27.4 App

- `constants/planos.ts` — `PLANO_IDS`, `PLANO_NOMES`, valores de referência em BRL.
- `constants/planoMarketing.ts` — copy de trial, cancelamento nos primeiros 5 dias e textos de preço (espelha regras abaixo).

**Regras comerciais LashMatch (assinatura Mercado Pago):**

| Regra | Valor |
|--------|--------|
| Prazo para cancelar sem cobrança | **5 dias** (período inicial; conforme condições do MP) |
| Plano mensal | **R$ 60,00** por mês, **cobrança recorrente mensal** (uma vez por mês) |
| Plano anual | **R$ 600,00** por ano, **cobrança recorrente anual** (uma cobrança por ano) |

Os valores numéricos devem coincidir com `functions/SRC/planosConfig.ts` (`transaction_amount` + `frequency` / `frequency_type`).

### 27.5 Checklist

- [ ] `MP_PLANO_SETUP_KEY` definido no ambiente das functions antes de usar `criarPlanoMP`
- [ ] Após criar planos no MP, documento `config/mercadopago_planos` preenchido (ou rodar `criarPlanoMP` por plano)
- [ ] Painel MP ou preapproval com URL de `webhookAssinatura` para sincronizar status
- [ ] App usa `PLANO_IDS` / tipos de `constants/planos.ts` ao chamar `criarAssinatura`

---

*Última atualização: abril 2026 | Fontes: reactnative.dev/docs · docs.expo.dev/guides/using-firebase · Curso React Native Expo Go — Caio Eduardo · Projeto LashMatch (referência principal) · developer.z-api.io · mercadopago.com.br/developers/pt/docs*
