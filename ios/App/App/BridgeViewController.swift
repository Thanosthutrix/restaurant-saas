import UIKit
import Capacitor

/// Coque WebView iOS : swipe retour Safari + fond aligné sur l'app (évite le noir au scroll).
class BridgeViewController: CAPBridgeViewController {
    private let appBackground = UIColor(red: 233 / 255, green: 237 / 255, blue: 242 / 255, alpha: 1)

    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let webView = webView else { return }

        webView.allowsBackForwardNavigationGestures = true

        webView.scrollView.bounces = false
        webView.scrollView.alwaysBounceVertical = false
        webView.scrollView.alwaysBounceHorizontal = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        view.backgroundColor = appBackground
        webView.backgroundColor = appBackground
        webView.scrollView.backgroundColor = appBackground
        webView.isOpaque = true
    }
}
