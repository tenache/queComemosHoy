# -*- coding: utf-8 -*-
"""
Created on Sat Sep 25 20:20:18 2021

@author: Usuario
"""

class ingrediente:
    def __init__(self,nombre):
        self.nombre = nombre
        self.reciente = 1
        #self.costo = 1
        #self.salud = 1
        #self.rico = 1
        self.comidas = []
        self.guarniciones = []
    def agregarComida(self,listaDeComidas):
        try:
            for comida in listaDeComidas:
                self.comidas.append(comida)
                comida.ingredientes.append(self)
        except TypeError:
            self.comidas.append(listaDeComidas)
            listaDeComidas.ingredientes.append(self)
    def agregarGuarnicion(self,listaDeGuarniciones):
        try:
            for guarnicion in listaDeGuarniciones:
                guarnicion.ingredientes.append(self)
                self.guarniciones.append(guarnicion)
        except TypeError:
            listaDeGuarniciones.ingredientes.append(self)
            self.guarniciones.append(listaDeGuarniciones)
    def guardar(self,usuario):
        usuario.ingredientes.append(self)
        usuario.guardar()