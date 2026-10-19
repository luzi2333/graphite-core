import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

/*
 * 签名配置：从根目录的 keystore.properties 读取。
 * 文件不存在时 release 会打出未签名 APK，不会让构建失败。
 */
val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = Properties().apply {
    if (keystorePropsFile.exists()) {
        keystorePropsFile.inputStream().use { load(it) }
    }
}
val hasSigning = keystorePropsFile.exists() &&
    keystoreProps.getProperty("storeFile") != null &&
    keystoreProps.getProperty("storePassword") != null

android {
    namespace = "com.example.graphitecore"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.example.graphitecore"
        minSdk = 29
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    signingConfigs {
        if (hasSigning) {
            create("release") {
                storeFile = file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (hasSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
}

/*
 * 网页来源，两种目录结构都能用：
 *   本地        .../graphite-core    + .../graphite-android
 *   仓库分支    根目录就是网页         + graphite-android/
 * 所以上传到 GitHub 时只要传 graphite-android，网页不用复制第二份。
 */
val localWeb = rootProject.file("../graphite-core")
val repoRoot = rootProject.file("..")
val webIsRepoRoot = !localWeb.resolve("index.html").exists() && repoRoot.resolve("index.html").exists()
val webSource = if (webIsRepoRoot) repoRoot else localWeb

tasks.register<Copy>("copyWebAssets") {
    from(webSource) {
        exclude("**/*.md")
        exclude("**/.git/**")
        exclude("**/.gradle/**")
        exclude("**/build/**")
        if (webIsRepoRoot) {
            exclude("graphite-android/**")
            exclude("graphite-core/**")
        }
    }
    into(layout.projectDirectory.dir("src/main/assets"))
}

tasks.named("preBuild") {
    dependsOn("copyWebAssets")
}
