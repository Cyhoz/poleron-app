import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>¡Ups! Algo salió mal</Text>
            <Text style={styles.message}>
              La aplicación ha encontrado un error inesperado.
            </Text>
            
            <TouchableOpacity style={styles.button} onPress={this.handleRestart}>
              <Text style={styles.buttonText}>Intentar de nuevo</Text>
            </TouchableOpacity>

            <Text style={styles.errorText}>{this.state.error?.message || 'Error desconocido'}</Text>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
  },
  content: {
    padding: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 15,
  },
  message: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 50,
  }
});

export default ErrorBoundary;
